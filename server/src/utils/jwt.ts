import jwt, { type JwtPayload } from 'jsonwebtoken';
import { env } from '../config/env';

export interface TokenUser {
  id: number;
  username: string;
  tokenVersion: number;
}

const ISSUER = 'techfix-api';
const AUDIENCE = 'techfix-web';

export function signToken(user: TokenUser): string {
  return jwt.sign(user, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    issuer: ISSUER,
    audience: AUDIENCE,
    algorithm: 'HS256'
  });
}

export function verifyToken(token: string): TokenUser {
  const decoded = jwt.verify(token, env.JWT_SECRET, {
    issuer: ISSUER,
    audience: AUDIENCE,
    algorithms: ['HS256']
  });
  if (typeof decoded === 'string') throw new Error('Invalid token payload.');
  const payload = decoded as JwtPayload & Partial<TokenUser>;
  if (!Number.isSafeInteger(payload.id) || !payload.username || !Number.isInteger(payload.tokenVersion)) {
    throw new Error('Invalid token claims.');
  }
  return { id: payload.id!, username: payload.username!, tokenVersion: payload.tokenVersion! };
}
