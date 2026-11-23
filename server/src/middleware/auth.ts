import type { Request, Response, NextFunction } from 'express';
import { pool } from '../db/pool';
import { ApiError } from '../utils/api-error';
import { verifyToken, type TokenUser } from '../utils/jwt';
import { ACCESS_COOKIE, readCookie } from './security';

export type UserRole = 'admin' | 'technician';
export interface AuthenticatedUser { id: number; username: string; role: UserRole; firstName: string; lastName: string; }

declare global {
  namespace Express {
    interface Request { user?: AuthenticatedUser; }
  }
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = readCookie(req, ACCESS_COOKIE);
  if (!token) return next(new ApiError(401, 'Authentication required.'));
  let claims: TokenUser;
  try { claims = verifyToken(token); }
  catch { return next(new ApiError(401, 'Your session is invalid or has expired. Please sign in again.')); }

  const result = await pool.query(
    `SELECT id, username, role, first_name AS "firstName", last_name AS "lastName", token_version AS "tokenVersion"
     FROM users WHERE id = $1 AND is_active = TRUE`, [claims.id]
  );
  const account = result.rows[0];
  if (!account || Number(account.tokenVersion) !== claims.tokenVersion || account.username !== claims.username) {
    return next(new ApiError(401, 'Your session has expired. Please sign in again.'));
  }
  req.user = {
    id: Number(account.id), username: account.username,
    role: account.role as UserRole, firstName: account.firstName, lastName: account.lastName
  };
  next();
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) return next(new ApiError(403, 'You do not have permission to perform this action.'));
    next();
  };
}
