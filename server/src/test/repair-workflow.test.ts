import test from 'node:test';
import assert from 'node:assert/strict';
import { canTransitionRepair, centsToMoney, moneyToCents, paymentStatus } from '../utils/repair-workflow';
import { pageWindow } from '../utils/pagination';
import { isOriginAllowed } from '../utils/origin-policy';
import { changePasswordSchema, paymentCreateSchema, repairCreateSchema } from '../validators/schemas';

test('repair workflow allows only forward transitions and the defined rework loop', () => {
  assert.equal(canTransitionRepair('pending', 'approved'), true);
  assert.equal(canTransitionRepair('approved', 'in_progress'), true);
  assert.equal(canTransitionRepair('in_progress', 'checking'), true);
  assert.equal(canTransitionRepair('checking', 'in_progress'), true);
  assert.equal(canTransitionRepair('checking', 'done'), true);
  assert.equal(canTransitionRepair('pending', 'done'), false);
  assert.equal(canTransitionRepair('done', 'in_progress'), false);
  assert.equal(canTransitionRepair('cancelled', 'approved'), false);
});

test('money helpers work in integer minor units without floating point summation', () => {
  assert.equal(moneyToCents('125.30'), 12530);
  assert.equal(moneyToCents('0'), 0);
  assert.equal(centsToMoney(12530), '125.30');
  assert.equal(centsToMoney(5), '0.05');
  assert.equal(paymentStatus(10000, 0), 'unpaid');
  assert.equal(paymentStatus(10000, 2500), 'partial');
  assert.equal(paymentStatus(10000, 10000), 'paid');
  assert.throws(() => moneyToCents('12.345'));
});

test('repair creation schema rejects duplicate services and invalid money', () => {
  const valid = { clientId: 2, remarks: 'Screen damaged', serviceIds: [1, 2], materials: [{ name: 'Panel', cost: 1200.5 }] };
  assert.equal(repairCreateSchema.safeParse(valid).success, true);
  assert.equal(repairCreateSchema.safeParse({ ...valid, serviceIds: [1, 1] }).success, false);
  assert.equal(repairCreateSchema.safeParse({ ...valid, serviceIds: [1], materials: [{ name: 'Panel', cost: -1 }] }).success, false);
  assert.equal(repairCreateSchema.safeParse({ ...valid, isAdmin: true }).success, false);
});

test('payment schema requires positive amount and a supported payment method', () => {
  assert.equal(paymentCreateSchema.safeParse({ idempotencyKey: '550e8400-e29b-41d4-a716-446655440000', amount: 150.25, method: 'upi', reference: 'UPI-REF-1' }).success, true);
  assert.equal(paymentCreateSchema.safeParse({ idempotencyKey: '550e8400-e29b-41d4-a716-446655440000', amount: 0, method: 'cash' }).success, false);
  assert.equal(paymentCreateSchema.safeParse({ idempotencyKey: '550e8400-e29b-41d4-a716-446655440000', amount: 10, method: 'crypto' }).success, false);
});

test('password policy requires a long mixed-character password', () => {
  assert.equal(changePasswordSchema.safeParse({ currentPassword: 'old', newPassword: 'Secure!Pass2026X' }).success, true);
  assert.equal(changePasswordSchema.safeParse({ currentPassword: 'old', newPassword: 'password123456' }).success, false);
});


test('pagination clamps pages, bounds page size and reports consistent offsets', () => {
  assert.deepEqual(pageWindow(45, 2, 20), { page: 2, pageSize: 20, total: 45, totalPages: 3, offset: 20 });
  assert.deepEqual(pageWindow(0, 8, 100), { page: 1, pageSize: 100, total: 0, totalPages: 1, offset: 0 });
  assert.deepEqual(pageWindow(21, 99, 20), { page: 2, pageSize: 20, total: 21, totalPages: 2, offset: 20 });
  assert.throws(() => pageWindow(-1, 1, 20));
  assert.throws(() => pageWindow(1, 1, 101));
});


test('production Origin policy requires exact Origin on unsafe browser requests', () => {
  const allowlist = ['https://app.example.com'];
  assert.equal(isOriginAllowed('https://app.example.com', 'POST', allowlist, true), true);
  assert.equal(isOriginAllowed('https://evil.example', 'POST', allowlist, true), false);
  assert.equal(isOriginAllowed(undefined, 'POST', allowlist, true), false);
  assert.equal(isOriginAllowed(undefined, 'GET', allowlist, true), true);
  assert.equal(isOriginAllowed('https://evil.example', 'GET', allowlist, true), false);
  assert.equal(isOriginAllowed(undefined, 'POST', allowlist, false), true);
});
