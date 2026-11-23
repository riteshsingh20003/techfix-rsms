import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { Request, Response } from 'express';
import { pool } from '../db/pool';
import { ApiError } from '../utils/api-error';
import { signToken } from '../utils/jwt';
import { clearSessionCookies, setSessionCookies } from '../middleware/security';
import { env } from '../config/env';
import { createCsrfToken } from '../utils/csrf';

const dummyPasswordHash = bcrypt.hash(randomBytes(32).toString('hex'), 12);
function csrfValue() { return createCsrfToken(env.JWT_SECRET); }
function toUser(row: Record<string, unknown>) {
  return {
    id: Number(row.id), username: String(row.username), role: row.role as 'admin' | 'technician',
    firstName: String(row.firstName), lastName: String(row.lastName)
  };
}

export async function login(req: Request, res: Response) {
  const { username, password } = req.body as { username: string; password: string };
  const result = await pool.query(
    `SELECT id, first_name AS "firstName", last_name AS "lastName", username, password_hash,
            role, token_version AS "tokenVersion"
     FROM users WHERE username = $1 AND is_active = TRUE`, [username]
  );
  const account = result.rows[0];
  // Keep unknown-user and wrong-password attempts close in timing to reduce username enumeration.
  const candidateHash = account?.password_hash ?? await dummyPasswordHash;
  const passwordMatches = await bcrypt.compare(password, candidateHash);
  if (!account || !passwordMatches) {
    throw new ApiError(401, 'Incorrect username or password.');
  }
  const token = signToken({ id: Number(account.id), username: account.username, tokenVersion: Number(account.tokenVersion) });
  const csrfToken = csrfValue();
  setSessionCookies(res, token, csrfToken);
  await pool.query('UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1', [account.id]);
  res.json({ success: true, data: { user: toUser(account) } });
}

export async function me(req: Request, res: Response) {
  res.json({ success: true, data: req.user });
}

export async function logout(req: Request, res: Response) {
  // Always remove the browser cookie; the DB update revokes any copied token as well.
  clearSessionCookies(res);
  await pool.query('UPDATE users SET token_version = token_version + 1, updated_at = NOW() WHERE id = $1', [req.user!.id]);
  res.status(204).end();
}

export async function changePassword(req: Request, res: Response) {
  const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };
  const result = await pool.query('SELECT password_hash FROM users WHERE id = $1 AND is_active = TRUE', [req.user!.id]);
  const account = result.rows[0];
  if (!account || !(await bcrypt.compare(currentPassword, account.password_hash))) {
    throw new ApiError(400, 'Current password is incorrect.');
  }
  if (await bcrypt.compare(newPassword, account.password_hash)) {
    throw new ApiError(400, 'Choose a new password that is different from your current password.');
  }
  const hash = await bcrypt.hash(newPassword, 12);
  const updated = await pool.query(
    `UPDATE users SET password_hash = $1, token_version = token_version + 1, updated_at = NOW()
     WHERE id = $2 AND is_active = TRUE RETURNING token_version AS "tokenVersion"`, [hash, req.user!.id]
  );
  if (!updated.rowCount) throw new ApiError(401, 'Your account is no longer active.');
  const token = signToken({ id: req.user!.id, username: req.user!.username, tokenVersion: Number(updated.rows[0].tokenVersion) });
  const csrfToken = csrfValue();
  setSessionCookies(res, token, csrfToken);
  res.json({ success: true, data: { user: req.user }, message: 'Password changed. Other sessions have been signed out.' });
}
