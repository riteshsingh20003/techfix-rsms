import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const TOKEN_PATTERN = /^([a-f0-9]{64})\.([a-f0-9]{64})$/i;

function signature(secret: string, nonce: string): Buffer {
  return createHmac('sha256', secret).update(`techfix-csrf-v1:${nonce}`).digest();
}

/** Signed double-submit token: a cookie injected by an untrusted sibling host cannot pass verification. */
export function createCsrfToken(secret: string): string {
  const nonce = randomBytes(32).toString('hex');
  return `${nonce}.${signature(secret, nonce).toString('hex')}`;
}

export function verifyCsrfToken(secret: string, token: string): boolean {
  const match = TOKEN_PATTERN.exec(token);
  if (!match) return false;
  const expected = signature(secret, match[1]);
  const supplied = Buffer.from(match[2], 'hex');
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
