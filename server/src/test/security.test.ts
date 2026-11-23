import test from 'node:test';
import assert from 'node:assert/strict';
import { createCsrfToken, verifyCsrfToken } from '../utils/csrf';

const secret = 'test-secret-that-is-at-least-32-bytes-long-and-random';

test('signed CSRF tokens verify only with the signing secret', () => {
  const token = createCsrfToken(secret);
  assert.match(token, /^[a-f0-9]{64}\.[a-f0-9]{64}$/i);
  assert.equal(verifyCsrfToken(secret, token), true);
  assert.equal(verifyCsrfToken('a-different-secret-that-is-not-the-same', token), false);
});

test('CSRF verification rejects tampering and attacker-injected values', () => {
  const token = createCsrfToken(secret);
  const [nonce, signature] = token.split('.');
  const changed = `${nonce}.${signature.slice(0, -1)}${signature.endsWith('0') ? '1' : '0'}`;
  assert.equal(verifyCsrfToken(secret, changed), false);
  assert.equal(verifyCsrfToken(secret, 'attacker-controlled-cookie'), false);
  assert.equal(verifyCsrfToken(secret, ''), false);
});
