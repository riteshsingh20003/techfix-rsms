import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { allowedOrigins, env } from './config/env';
import authRoutes from './routes/auth.routes';
import clientRoutes from './routes/client.routes';
import serviceRoutes from './routes/service.routes';
import repairRoutes from './routes/repair.routes';
import dashboardRoutes from './routes/dashboard.routes';
import { errorHandler, notFound } from './middleware/error-handler';
import { originGuard } from './middleware/security';
import { rateLimit } from './middleware/rate-limit';
import { pool } from './db/pool';

const app = express();
app.disable('x-powered-by');
if (env.TRUST_PROXY_HOPS > 0) app.set('trust proxy', env.TRUST_PROXY_HOPS);
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-CSRF-Token']
}));
app.use(express.json({ limit: '256kb', strict: true }));
app.use(express.urlencoded({ extended: false, limit: '64kb', parameterLimit: 100 }));
morgan.token('url-safe', (req) => (req as express.Request).path.replace(/\/track\/[^/]+/i, '/track/[REDACTED]'));
if (env.NODE_ENV !== 'test') app.use(morgan(':remote-addr :method :url-safe :status :response-time ms', { skip: (req) => req.path === '/api/health/live' }));
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));
app.use('/api', originGuard);
app.use('/api', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });

app.get('/api/health/live', (_req, res) => res.json({ success: true, data: { status: 'ok' } }));
app.get('/api/health/ready', async (_req, res, next) => {
  try { await pool.query('SELECT 1'); res.json({ success: true, data: { status: 'ready', database: 'connected' } }); }
  catch { next(new Error('Database readiness check failed.')); }
});
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/repairs', repairRoutes);
app.use(notFound);
app.use(errorHandler);

export default app;
