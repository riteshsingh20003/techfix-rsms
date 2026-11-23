import { pool } from '../db/pool';
import { pageWindow } from '../utils/pagination';

export interface ServiceInput { name: string; description?: string; price: number; }
const fields = `id, name, description, price::text AS price, created_at AS "createdAt", updated_at AS "updatedAt"`;

export const ServiceModel = {
  async list(search = '', requestedPage = 1, pageSize = 20) {
    const pattern = `%${search}%`;
    const where = `WHERE archived_at IS NULL AND ($1 = '' OR name ILIKE $2 OR description ILIKE $2)`;
    const count = await pool.query(`SELECT COUNT(*)::bigint AS total FROM services ${where}`, [search, pattern]);
    const pagination = pageWindow(Number(count.rows[0]?.total ?? 0), requestedPage, pageSize);
    const { total, page, totalPages, offset } = pagination;
    const result = await pool.query(
      `SELECT ${fields} FROM services ${where}
       ORDER BY name ASC, id ASC LIMIT $3 OFFSET $4`,
      [search, pattern, pageSize, offset]
    );
    return { items: result.rows, page, pageSize, total, totalPages };
  },
  async findById(id: number) {
    const result = await pool.query(`SELECT ${fields} FROM services WHERE id = $1 AND archived_at IS NULL`, [id]);
    return result.rows[0] ?? null;
  },
  async create(input: ServiceInput) {
    const result = await pool.query(
      `INSERT INTO services (name, description, price) VALUES ($1, $2, $3) RETURNING ${fields}`,
      [input.name, input.description ?? '', input.price.toFixed(2)]
    );
    return result.rows[0];
  },
  async update(id: number, input: Partial<ServiceInput>) {
    const columns: Record<string, string> = { name: 'name', description: 'description', price: 'price' };
    const sets: string[] = [];
    const values: unknown[] = [];
    for (const [key, value] of Object.entries(input)) {
      if (columns[key] && value !== undefined) {
        values.push(key === 'price' ? Number(value).toFixed(2) : value);
        sets.push(`${columns[key]} = $${values.length}`);
      }
    }
    values.push(id);
    const result = await pool.query(
      `UPDATE services SET ${sets.join(', ')}, updated_at = NOW()
       WHERE id = $${values.length} AND archived_at IS NULL RETURNING ${fields}`,
      values
    );
    return result.rows[0] ?? null;
  },
  async archive(id: number) {
    const result = await pool.query(
      'UPDATE services SET archived_at = NOW(), updated_at = NOW() WHERE id = $1 AND archived_at IS NULL RETURNING id', [id]
    );
    return (result.rowCount ?? 0) > 0;
  }
};
