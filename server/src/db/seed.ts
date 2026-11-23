import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { env } from '../config/env';
import { pool } from './pool';
import { runMigrations } from './migrate';

async function seed() {
  await runMigrations();
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const services = [
      ['Hardware cleaning', 'Internal dust cleaning and hardware inspection.', '350.00'],
      ['Operating system installation', 'Licensed operating system installation and setup.', '1200.00'],
      ['Mobile reformatting', 'Mobile device reset and software setup.', '250.00'],
      ['Device diagnostics', 'Hardware and software diagnostics.', '400.00']
    ] as const;
    for (const service of services) {
      await db.query(
        `INSERT INTO services (name, description, price)
         SELECT $1, $2, $3::numeric
         WHERE NOT EXISTS (SELECT 1 FROM services WHERE lower(name) = lower($1) AND archived_at IS NULL)
         ON CONFLICT DO NOTHING`, [...service]
      );
    }

    const existingAdmin = await db.query("SELECT id FROM users WHERE role = 'admin' AND is_active = TRUE LIMIT 1");
    if (!existingAdmin.rowCount) {
      if (!env.INITIAL_ADMIN_USERNAME || !env.INITIAL_ADMIN_PASSWORD) {
        throw new Error('No active administrator exists. Set INITIAL_ADMIN_USERNAME and INITIAL_ADMIN_PASSWORD (14+ characters) in server/.env, then run npm run db:setup again.');
      }
      const password = env.INITIAL_ADMIN_PASSWORD;
      if (Buffer.byteLength(password, 'utf8') > 72 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password) || /(password|qwerty|123456|admin)/i.test(password)) {
        throw new Error('INITIAL_ADMIN_PASSWORD must contain uppercase, lowercase, a number and a symbol, and must not contain common password words.');
      }
      const hash = await bcrypt.hash(password, 12);
      await db.query(
        `INSERT INTO users (first_name, last_name, username, password_hash, role)
         VALUES ('TechFix', 'Administrator', $1, $2, 'admin')`, [env.INITIAL_ADMIN_USERNAME, hash]
      );
      console.log(`Created initial administrator account: ${env.INITIAL_ADMIN_USERNAME}`);
    }
    await db.query('COMMIT');
    console.log(`Database migrations and starter services are ready (${env.NODE_ENV}).`);
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    db.release();
  }
}

seed()
  .catch((error) => { console.error('Database setup failed:', error instanceof Error ? error.message : 'Unknown error'); process.exitCode = 1; })
  .finally(async () => { await pool.end(); });
