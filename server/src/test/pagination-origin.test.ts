import test from 'node:test';
import assert from 'node:assert/strict';
import { pageWindow } from '../utils/pagination';
import { isOriginAllowed } from '../utils/origin-policy';
import { canTransitionRepair, centsToMoney, moneyToCents, paymentStatus } from '../utils/repair-workflow';

test('pagination clamps requested pages and never exceeds the configured page size', () => {
  assert.deepEqual(pageWindow(45, 2, 20), { page: 2, pageSize: 20, total: 45, totalPages: 3, offset: 20 });
  assert.deepEqual(pageWindow(0, 8, 100), { page: 1, pageSize: 100, total: 0, totalPages: 1, offset: 0 });
  assert.deepEqual(pageWindow(21, 99, 20), { page: 2, pageSize: 20, total: 21, totalPages: 2, offset: 20 });
  assert.throws(() => pageWindow(-1, 1, 20));
  assert.throws(() => pageWindow(1, 1, 101));
});

test('production Origin policy requires an exact Origin for unsafe methods', () => {
  const allowlist = ['https://app.example.com'];
  assert.equal(isOriginAllowed('https://app.example.com', 'POST', allowlist, true), true);
  assert.equal(isOriginAllowed('https://evil.example', 'POST', allowlist, true), false);
  assert.equal(isOriginAllowed(undefined, 'POST', allowlist, true), false);
  assert.equal(isOriginAllowed(undefined, 'GET', allowlist, true), true);
  assert.equal(isOriginAllowed('https://evil.example', 'GET', allowlist, true), false);
  assert.equal(isOriginAllowed(undefined, 'POST', allowlist, false), true);
});

test('repair state machine rejects out-of-order and terminal-state transitions', () => {
  assert.equal(canTransitionRepair('pending', 'approved'), true);
  assert.equal(canTransitionRepair('checking', 'in_progress'), true);
  assert.equal(canTransitionRepair('pending', 'done'), false);
  assert.equal(canTransitionRepair('done', 'in_progress'), false);
  assert.equal(canTransitionRepair('cancelled', 'approved'), false);
});

test('money operations use integer minor units and preserve exact two-decimal values', () => {
  assert.equal(moneyToCents('125.30'), 12530);
  assert.equal(moneyToCents('0'), 0);
  assert.equal(centsToMoney(12530), '125.30');
  assert.equal(centsToMoney(5), '0.05');
  assert.equal(paymentStatus(10000, 0), 'unpaid');
  assert.equal(paymentStatus(10000, 2500), 'partial');
  assert.equal(paymentStatus(10000, 10000), 'paid');
  assert.throws(() => moneyToCents('12.345'));
});
