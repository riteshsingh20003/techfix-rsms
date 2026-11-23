import { randomBytes } from 'node:crypto';
import { pool } from '../db/pool';
import { pageWindow } from '../utils/pagination';
import type { PoolClient } from 'pg';
import { ApiError } from '../utils/api-error';
import { canTransitionRepair, centsToMoney, moneyToCents, paymentStatus, type RepairStatus } from '../utils/repair-workflow';

export interface RepairInput {
  clientId: number;
  remarks: string;
  serviceIds: number[];
  materials: Array<{ name: string; cost: number }>;
}
export interface RepairStatusInput { status?: RepairStatus; remarks?: string; }
export interface PaymentInput { idempotencyKey: string; amount: number; method: 'cash' | 'card' | 'upi' | 'bank_transfer'; reference?: string; }

const summarySelect = `SELECT r.id, r.code, r.client_id AS "clientId",
  c.first_name || ' ' || c.last_name AS "clientName", c.phone AS "clientPhone",
  r.remarks, r.total_amount::text AS "totalAmount", r.payment_status AS "paymentStatus",
  COALESCE(p.paid_amount, 0)::numeric(12,2)::text AS "amountPaid",
  GREATEST(r.total_amount - COALESCE(p.paid_amount, 0), 0)::numeric(12,2)::text AS "outstandingBalance",
  r.status, r.created_at AS "createdAt", r.updated_at AS "updatedAt"
  FROM repairs r INNER JOIN clients c ON c.id = r.client_id
  LEFT JOIN LATERAL (SELECT SUM(amount) AS paid_amount FROM payments WHERE repair_id = r.id) p ON TRUE`;

async function linesForRepair(db: typeof pool | PoolClient, repairId: number) {
  const [services, materials, payments, history] = await Promise.all([
    db.query(`SELECT id, service_name AS name, fee::text AS fee FROM repair_services WHERE repair_id = $1 ORDER BY id`, [repairId]),
    db.query(`SELECT id, name, cost::text AS cost FROM repair_materials WHERE repair_id = $1 ORDER BY id`, [repairId]),
    db.query(`SELECT id, amount::text AS amount, method, reference, created_at AS "createdAt" FROM payments WHERE repair_id = $1 ORDER BY created_at DESC, id DESC`, [repairId]),
    db.query(`SELECT id, old_status AS "oldStatus", new_status AS "newStatus", created_at AS "createdAt" FROM repair_status_history WHERE repair_id = $1 ORDER BY created_at ASC, id ASC`, [repairId])
  ]);
  return { services: services.rows, materials: materials.rows, payments: payments.rows, history: history.rows };
}

function newRepairCode() {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  return `TF-${date}-${randomBytes(16).toString('hex').toUpperCase()}`;
}

export const RepairModel = {
  async list(search = '', status = '', requestedPage = 1, pageSize = 20) {
    const pattern = `%${search}%`;
    const where = `WHERE ($1 = '' OR r.code ILIKE $2 OR c.first_name ILIKE $2 OR c.last_name ILIKE $2)
                   AND ($3 = '' OR r.status = $3)`;
    const count = await pool.query(
      `SELECT COUNT(*)::bigint AS total FROM repairs r JOIN clients c ON c.id = r.client_id ${where}`,
      [search, pattern, status]
    );
    const pagination = pageWindow(Number(count.rows[0]?.total ?? 0), requestedPage, pageSize);
    const { total, page, totalPages, offset } = pagination;
    const result = await pool.query(
      `${summarySelect} ${where}
       ORDER BY r.created_at DESC, r.id DESC LIMIT $4 OFFSET $5`,
      [search, pattern, status, pageSize, offset]
    );
    return { items: result.rows, page, pageSize, total, totalPages };
  },

  async findById(id: number) {
    const result = await pool.query(`${summarySelect} WHERE r.id = $1`, [id]);
    if (!result.rows[0]) return null;
    return { ...result.rows[0], ...(await linesForRepair(pool, id)) };
  },

  async findPublicStatus(code: string) {
    const result = await pool.query(
      `SELECT code, status, created_at AS "createdAt", updated_at AS "updatedAt"
       FROM repairs WHERE UPPER(code) = UPPER($1)`, [code]
    );
    // Treat the repair code as a bearer secret: do not reveal names, contact data,
    // internal remarks, itemized charges, or payment details on the public endpoint.
    return result.rows[0] ?? null;
  },

  async create(input: RepairInput, createdBy: number) {
    const db = await pool.connect();
    let repairId = 0;
    try {
      await db.query('BEGIN');
      const client = await db.query('SELECT id FROM clients WHERE id = $1 FOR KEY SHARE', [input.clientId]);
      if (!client.rowCount) throw new ApiError(404, 'Selected customer was not found.');

      const services = await db.query(
        'SELECT id, name, price::text AS price FROM services WHERE id = ANY($1::bigint[]) AND archived_at IS NULL ORDER BY id', [input.serviceIds]
      );
      if ((services.rowCount ?? 0) !== input.serviceIds.length) {
        throw new ApiError(400, 'One or more selected services are unavailable. Refresh the catalogue and try again.');
      }

      const inserted = await db.query(
        `INSERT INTO repairs (code, client_id, remarks, created_by)
         VALUES ($1, $2, $3, $4) RETURNING id`, [newRepairCode(), input.clientId, input.remarks, createdBy]
      );
      repairId = Number(inserted.rows[0].id);

      let totalCents = 0;
      for (const service of services.rows) {
        const feeCents = moneyToCents(service.price);
        totalCents += feeCents;
        await db.query(
          `INSERT INTO repair_services (repair_id, service_id, service_name, fee) VALUES ($1, $2, $3, $4)`,
          [repairId, service.id, service.name, centsToMoney(feeCents)]
        );
      }
      for (const material of input.materials) {
        const costCents = Math.round(material.cost * 100);
        totalCents += costCents;
        await db.query(
          'INSERT INTO repair_materials (repair_id, name, cost) VALUES ($1, $2, $3)',
          [repairId, material.name, centsToMoney(costCents)]
        );
      }
      if (!Number.isSafeInteger(totalCents) || totalCents > 99_999_999_999) throw new ApiError(400, 'The repair total exceeds the supported amount.');
      await db.query('UPDATE repairs SET total_amount = $1, payment_status = $2 WHERE id = $3', [centsToMoney(totalCents), paymentStatus(totalCents, 0), repairId]);
      await db.query(
        `INSERT INTO repair_status_history (repair_id, old_status, new_status, changed_by)
         VALUES ($1, NULL, 'pending', $2)`, [repairId, createdBy]
      );
      await db.query('COMMIT');
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    } finally {
      db.release();
    }
    return this.findById(repairId);
  },

  async updateStatus(id: number, input: RepairStatusInput, changedBy: number) {
    const db = await pool.connect();
    try {
      await db.query('BEGIN');
      const result = await db.query(
        `SELECT status, payment_status AS "paymentStatus" FROM repairs WHERE id = $1 FOR UPDATE`, [id]
      );
      if (!result.rowCount) { await db.query('ROLLBACK'); return null; }
      const current = result.rows[0].status as RepairStatus;
      const next = input.status ?? current;
      if (input.status && !canTransitionRepair(current, next)) {
        throw new ApiError(409, `Repair cannot move from ${current.replaceAll('_', ' ')} to ${next.replaceAll('_', ' ')}.`);
      }
      if (input.status === 'cancelled') {
        const paid = await db.query('SELECT 1 FROM payments WHERE repair_id = $1 LIMIT 1', [id]);
        if (paid.rowCount) throw new ApiError(409, 'A repair with recorded payments cannot be cancelled. Process a refund first.');
      }
      await db.query(
        `UPDATE repairs SET status = $1, remarks = COALESCE($2, remarks), updated_at = NOW() WHERE id = $3`,
        [next, input.remarks ?? null, id]
      );
      if (input.status && input.status !== current) {
        await db.query(
          `INSERT INTO repair_status_history (repair_id, old_status, new_status, changed_by)
           VALUES ($1, $2, $3, $4)`, [id, current, next, changedBy]
        );
      }
      await db.query('COMMIT');
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    } finally {
      db.release();
    }
    // Do not wait for another pooled connection while the transaction client is held.
    return this.findById(id);
  },

  async createPayment(id: number, input: PaymentInput, recordedBy: number) {
    const db = await pool.connect();
    let created = false;
    try {
      await db.query('BEGIN');
      const result = await db.query(
        `SELECT total_amount::text AS "totalAmount", status FROM repairs WHERE id = $1 FOR UPDATE`, [id]
      );
      if (!result.rowCount) throw new ApiError(404, 'Repair not found.');

      const previousPayment = await db.query(
        `SELECT repair_id, amount::text AS amount, method, reference
         FROM payments WHERE idempotency_key = $1`, [input.idempotencyKey]
      );
      if (previousPayment.rowCount) {
        const prior = previousPayment.rows[0];
        const sameRequest = Number(prior.repair_id) === id
          && moneyToCents(prior.amount) === Math.round(input.amount * 100)
          && prior.method === input.method
          && prior.reference === (input.reference ?? '');
        if (!sameRequest) throw new ApiError(409, 'This payment request key was already used with different payment details.');
        await db.query('COMMIT');
        created = false;
      } else {
        if (result.rows[0].status !== 'done') throw new ApiError(409, 'Payments can only be recorded after a repair is marked completed.');

        const totalCents = moneyToCents(result.rows[0].totalAmount);
        const paidResult = await db.query('SELECT COALESCE(SUM(amount), 0)::text AS paid FROM payments WHERE repair_id = $1', [id]);
        const paidCents = moneyToCents(paidResult.rows[0].paid);
        const amountCents = Math.round(input.amount * 100);
        if (amountCents > totalCents - paidCents) {
          throw new ApiError(400, `Payment exceeds the remaining balance of ${centsToMoney(Math.max(0, totalCents - paidCents))}.`);
        }
        await db.query(
          `INSERT INTO payments (repair_id, amount, method, reference, recorded_by, idempotency_key)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [id, centsToMoney(amountCents), input.method, input.reference ?? '', recordedBy, input.idempotencyKey]
        );
        const nextPaidCents = paidCents + amountCents;
        await db.query(
          'UPDATE repairs SET payment_status = $1, updated_at = NOW() WHERE id = $2',
          [paymentStatus(totalCents, nextPaidCents), id]
        );
        await db.query('COMMIT');
        created = true;
      }
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    } finally {
      db.release();
    }
    // Release the transaction connection before using the shared pool for the response read.
    return { repair: await this.findById(id), created };
  }
};
