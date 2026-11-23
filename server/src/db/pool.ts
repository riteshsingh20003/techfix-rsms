import { Pool, types } from 'pg';
import { env } from '../config/env';

// Convert BIGINT IDs only when they remain exactly representable in JavaScript.
types.setTypeParser(20, (value) => {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error('A database identifier exceeds JavaScript safe integer range.');
  return parsed;
});

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 15_000,
  query_timeout: 20_000,
  ...(env.NODE_ENV === 'production' ? { ssl: { rejectUnauthorized: true } } : {})
});

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error:', error.message);
});
