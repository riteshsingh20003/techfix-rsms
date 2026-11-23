import { pool } from '../db/pool';
import { pageWindow } from '../utils/pagination';

export interface ClientInput {
  firstName: string; lastName: string; email?: string | null; phone: string; address?: string;
}
const fields = `id, first_name AS "firstName", last_name AS "lastName", email, phone, address,
                created_at AS "createdAt", updated_at AS "updatedAt"`;

export const ClientModel = {
  async list(search = '', requestedPage = 1, pageSize = 20) {
    const pattern = `%${search}%`;
    const where = `WHERE ($1 = '' OR first_name ILIKE $2 OR last_name ILIKE $2 OR phone ILIKE $2 OR COALESCE(email, '') ILIKE $2)`;
    const count = await pool.query(`SELECT COUNT(*)::bigint AS total FROM clients ${where}`, [search, pattern]);
    const pagination = pageWindow(Number(count.rows[0]?.total ?? 0), requestedPage, pageSize);
    const { total, page, totalPages, offset } = pagination;
    const result = await pool.query(
      `SELECT ${fields} FROM clients ${where}
       ORDER BY created_at DESC, id DESC LIMIT $3 OFFSET $4`,
      [search, pattern, pageSize, offset]
    );
    return { items: result.rows, page, pageSize, total, totalPages };
  },
  async findById(id: number) {
    const result = await pool.query(`SELECT ${fields} FROM clients WHERE id = $1`, [id]);
    return result.rows[0] ?? null;
  },
  async create(input: ClientInput) {
    const result = await pool.query(
      `INSERT INTO clients (first_name, last_name, email, phone, address)
       VALUES ($1, $2, $3, $4, $5) RETURNING ${fields}`,
      [input.firstName, input.lastName, input.email ?? null, input.phone, input.address ?? '']
    );
    return result.rows[0];
  },
  async update(id: number, input: Partial<ClientInput>) {
    const columns: Record<string, string> = { firstName: 'first_name', lastName: 'last_name', email: 'email', phone: 'phone', address: 'address' };
    const sets: string[] = [];
    const values: unknown[] = [];
    for (const [key, value] of Object.entries(input)) {
      if (columns[key] && value !== undefined) { values.push(value); sets.push(`${columns[key]} = $${values.length}`); }
    }
    values.push(id);
    const result = await pool.query(
      `UPDATE clients SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${values.length} RETURNING ${fields}`,
      values
    );
    return result.rows[0] ?? null;
  },
  async delete(id: number) {
    const result = await pool.query('DELETE FROM clients WHERE id = $1 RETURNING id', [id]);
    return (result.rowCount ?? 0) > 0;
  }
};
