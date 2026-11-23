import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ApiError } from '../utils/api-error';
import { env } from '../config/env';

export function notFound(req: Request, _res: Response, next: NextFunction) {
  next(new ApiError(404, `Route not found: ${req.method} ${req.path}`));
}

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (res.headersSent) return;
  if (error instanceof ZodError) {
    return res.status(400).json({ success: false, message: 'Validation failed.', errors: error.flatten().fieldErrors });
  }
  if (error instanceof ApiError) {
    return res.status(error.statusCode).json({ success: false, message: error.message, errors: error.details ?? null });
  }
  const candidate = error as { code?: string; type?: string; status?: number };
  if (candidate?.type === 'entity.too.large') {
    return res.status(413).json({ success: false, message: 'Request body is too large.' });
  }
  if (candidate?.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Request body contains invalid JSON.' });
  }
  if (candidate?.code === '23505') {
    return res.status(409).json({ success: false, message: 'A record with those details already exists.' });
  }
  if (candidate?.code === '23503') {
    return res.status(409).json({ success: false, message: 'This operation conflicts with related records.' });
  }
  if (candidate?.code === '23514' || candidate?.code === '22P02') {
    return res.status(400).json({ success: false, message: 'One or more submitted values are invalid.' });
  }
  if (env.NODE_ENV !== 'production') console.error(error);
  return res.status(500).json({ success: false, message: 'An unexpected server error occurred.' });
}
