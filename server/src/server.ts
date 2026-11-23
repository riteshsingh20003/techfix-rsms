import 'dotenv/config';
import app from './app';
import { env } from './config/env';
import { pool } from './db/pool';

const server = app.listen(env.PORT, () => {
  console.log(`TechFix API listening on port ${env.PORT}`);
});
server.requestTimeout = 30_000;
server.headersTimeout = 35_000;
server.keepAliveTimeout = 5_000;

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received. Closing server...`);
  const forceExit = setTimeout(() => {
    console.error('Graceful shutdown timed out. Forcing process exit.');
    process.exit(1);
  }, 10_000);
  forceExit.unref();
  server.close(async (error) => {
    try {
      await pool.end();
      if (error) console.error('HTTP server shutdown error:', error.message);
      clearTimeout(forceExit);
      process.exit(error ? 1 : 0);
    } catch (shutdownError) {
      console.error('Database shutdown error:', shutdownError);
      process.exit(1);
    }
  });
}
process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
