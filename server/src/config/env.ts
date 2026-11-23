import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must contain at least 32 characters'),
  JWT_EXPIRES_IN: z.enum(['15m', '1h', '12h', '1d']).default('12h'),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  INITIAL_ADMIN_USERNAME: z.preprocess((value) => value === '' ? undefined : value, z.string().trim().min(3).max(80).optional()),
  INITIAL_ADMIN_PASSWORD: z.preprocess((value) => value === '' ? undefined : value, z.string().min(14).max(72).refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Bcrypt passwords must be at most 72 UTF-8 bytes.').optional()),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0)
}).superRefine((value, ctx) => {
  if (value.NODE_ENV === 'production') {
    if (/generate|placeholder|replace-this|change-me|example|development/i.test(value.JWT_SECRET)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['JWT_SECRET'], message: 'Use a unique production JWT secret.' });
    }
    try {
      const database = new URL(value.DATABASE_URL);
      if (!['postgres:', 'postgresql:'].includes(database.protocol) || ['localhost', '127.0.0.1', '::1'].includes(database.hostname) || /local-development-only/i.test(value.DATABASE_URL)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['DATABASE_URL'], message: 'Production must use a remote PostgreSQL connection string and managed credentials.' });
      }
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['DATABASE_URL'], message: 'DATABASE_URL must be a valid PostgreSQL URL.' });
    }
    const origins = value.CLIENT_ORIGIN.split(',').map((origin) => origin.trim());
    const invalidOrigin = origins.some((origin) => {
      try { const parsed = new URL(origin); return parsed.protocol !== 'https:' || parsed.origin !== origin; }
      catch { return true; }
    });
    if (invalidOrigin) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['CLIENT_ORIGIN'], message: 'Production client origins must be explicit HTTPS origins; wildcards are not allowed.' });
    }
  }
  if (Boolean(value.INITIAL_ADMIN_USERNAME) !== Boolean(value.INITIAL_ADMIN_PASSWORD)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['INITIAL_ADMIN_PASSWORD'], message: 'Set both initial admin username and password, or neither.' });
  }
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const allowedOrigins = env.CLIENT_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean);
