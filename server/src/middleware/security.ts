import { timingSafeEqual } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { allowedOrigins, env } from '../config/env';
import { ApiError } from '../utils/api-error';
import { verifyCsrfToken } from '../utils/csrf';
import { isOriginAllowed } from '../utils/origin-policy';

// __Host- cookies are Secure, Path=/ and host-only by browser definition.
// Local HTTP development uses unprefixed names because Secure is unavailable there.
export const ACCESS_COOKIE = env.NODE_ENV === 'production' ? '__Host-techfix_session' : 'techfix_session';
export const CSRF_COOKIE = env.NODE_ENV === 'production' ? '__Host-techfix_csrf' : 'techfix_csrf';
const COOKIE_MAX_AGE: Record<'15m' | '1h' | '12h' | '1d', number> = {
  '15m': 15 * 60 * 1000, '1h': 60 * 60 * 1000, '12h': 12 * 60 * 60 * 1000, '1d': 24 * 60 * 60 * 1000
};

export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    const key = part.slice(0, separator).trim();
    if (key === name) {
      try { return decodeURIComponent(part.slice(separator + 1).trim()); }
      catch { return undefined; }
    }
  }
  return undefined;
}

function cookieOptions(httpOnly: boolean) {
  const maxAge = Math.floor(COOKIE_MAX_AGE[env.JWT_EXPIRES_IN] / 1000);
  return `Path=/; SameSite=Strict; Max-Age=${maxAge}${httpOnly ? '; HttpOnly' : ''}${env.NODE_ENV === 'production' ? '; Secure' : ''}`;
}

export function setSessionCookies(res: Response, token: string, csrfToken: string) {
  res.append('Set-Cookie', `${ACCESS_COOKIE}=${encodeURIComponent(token)}; ${cookieOptions(true)}`);
  res.append('Set-Cookie', `${CSRF_COOKIE}=${encodeURIComponent(csrfToken)}; ${cookieOptions(false)}`);
}

export function clearSessionCookies(res: Response) {
  const secure = env.NODE_ENV === 'production' ? '; Secure' : '';
  res.append('Set-Cookie', `${ACCESS_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`);
  res.append('Set-Cookie', `${CSRF_COOKIE}=; Path=/; SameSite=Strict; Max-Age=0${secure}`);
}

export function originGuard(req: Request, _res: Response, next: NextFunction) {
  const origin = req.get('origin');
  // Login has no pre-existing CSRF cookie, so enforce same-origin here too.
  if (!isOriginAllowed(origin, req.method, allowedOrigins, env.NODE_ENV === 'production')) {
    return next(new ApiError(403, 'Request origin is not allowed.'));
  }
  next();
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function requireCsrf(req: Request, _res: Response, next: NextFunction) {
  const cookie = readCookie(req, CSRF_COOKIE);
  const header = req.get('x-csrf-token');
  if (!cookie || !header) return next(new ApiError(403, 'Your security token is missing. Refresh the page and try again.'));
  // Require an allowed browser origin in production; this app is deployed same-origin behind a reverse proxy.
  if (env.NODE_ENV === 'production' && (!req.get('origin') || !allowedOrigins.includes(req.get('origin')!))) {
    return next(new ApiError(403, 'Request origin is not allowed.'));
  }
  if (!safeEqual(cookie, header) || !verifyCsrfToken(env.JWT_SECRET, cookie)) {
    return next(new ApiError(403, 'Your security token is invalid. Refresh the page and try again.'));
  }
  next();
}
