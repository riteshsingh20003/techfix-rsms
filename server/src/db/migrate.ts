import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { pool } from './pool';

// A fixed PostgreSQL advisory-lock key serializes schema changes across instances.
const MIGRATION_LOCK_KEY = '77120261122001';

export async function runMigrations() {
  const db = await pool.connect();
  let lockAcquired = false;
  try {
    await db.query('SELECT pg_advisory_lock($1::bigint)', [MIGRATION_LOCK_KEY]);
    lockAcquired = true;
    await db.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(180) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);

    const directory = path.join(__dirname, 'migrations');
    const files = (await readdir(directory)).filter((name) => /^\d+_[a-z0-9_-]+\.sql$/i.test(name)).sort();
    for (const file of files) {
      const applied = await db.query('SELECT 1 FROM schema_migrations WHERE version = $1', [file]);
      if (applied.rowCount) continue;
      const sql = await readFile(path.join(directory, file), 'utf8');
      await db.query('BEGIN');
      try {
        await db.query(sql);
        await db.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
        await db.query('COMMIT');
        console.log(`Applied database migration: ${file}`);
      } catch (error) {
        await db.query('ROLLBACK');
        throw error;
      }
    }

    // Replace old seven-character references before exposing the public tracking endpoint.
    const legacyReferences = await db.query(
      `SELECT id FROM repairs WHERE code ~ '^TF-[0-9]{8}-[A-Z0-9]{7}$' ORDER BY id`
    );
    if (legacyReferences.rowCount) {
      await db.query('BEGIN');
      try {
        for (const row of legacyReferences.rows) {
          const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
          const strongCode = `TF-${date}-${randomBytes(16).toString('hex').toUpperCase()}`;
          await db.query('UPDATE repairs SET code = $1, updated_at = NOW() WHERE id = $2', [strongCode, row.id]);
        }
        await db.query('COMMIT');
      } catch (error) {
        await db.query('ROLLBACK');
        throw error;
      }
      console.warn(`Rotated ${legacyReferences.rowCount} legacy repair reference(s). Reissue the new codes to those customers.`);
    }
  } finally {
    if (lockAcquired) {
      try { await db.query('SELECT pg_advisory_unlock($1::bigint)', [MIGRATION_LOCK_KEY]); }
      catch (error) { console.error('Could not explicitly release the migration lock; closing the connection will release it.', error); }
    }
    db.release();
  }
}
