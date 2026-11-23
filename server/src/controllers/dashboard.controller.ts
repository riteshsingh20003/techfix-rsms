import type { Request, Response } from 'express';
import { pool } from '../db/pool';

export async function getSummary(_req: Request, res: Response) {
  const [counts, recent] = await Promise.all([
    pool.query(`SELECT
      (SELECT COUNT(*)::int FROM clients) AS clients,
      (SELECT COUNT(*)::int FROM services WHERE archived_at IS NULL) AS services,
      (SELECT COUNT(*)::int FROM repairs) AS repairs,
      (SELECT COUNT(*)::int FROM repairs WHERE status = 'pending') AS pending,
      (SELECT COUNT(*)::int FROM repairs WHERE status = 'approved') AS approved,
      (SELECT COUNT(*)::int FROM repairs WHERE status = 'in_progress') AS in_progress,
      (SELECT COUNT(*)::int FROM repairs WHERE status = 'checking') AS checking,
      (SELECT COUNT(*)::int FROM repairs WHERE status = 'done') AS completed,
      (SELECT COUNT(*)::int FROM repairs WHERE status = 'cancelled') AS cancelled,
      (SELECT COALESCE(SUM(r.total_amount - COALESCE(p.paid_amount, 0)), 0)::numeric(14,2)::text
       FROM repairs r LEFT JOIN LATERAL (SELECT SUM(amount) AS paid_amount FROM payments WHERE repair_id = r.id) p ON TRUE
       WHERE r.status <> 'cancelled') AS outstanding`),
    pool.query(`SELECT r.id, r.code, r.status, r.payment_status AS "paymentStatus",
      r.total_amount::text AS "totalAmount", r.created_at AS "createdAt",
      c.first_name || ' ' || c.last_name AS "clientName"
      FROM repairs r JOIN clients c ON c.id = r.client_id
      ORDER BY r.created_at DESC, r.id DESC LIMIT 6`)
  ]);
  res.setHeader('Cache-Control', 'no-store');
  res.json({ success: true, data: { ...counts.rows[0], recentRepairs: recent.rows } });
}
