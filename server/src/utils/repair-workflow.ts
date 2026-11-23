export type RepairStatus = 'pending' | 'approved' | 'in_progress' | 'checking' | 'done' | 'cancelled';

const transitions: Record<RepairStatus, readonly RepairStatus[]> = {
  pending: ['approved', 'cancelled'],
  approved: ['in_progress', 'cancelled'],
  in_progress: ['checking', 'cancelled'],
  checking: ['in_progress', 'done', 'cancelled'],
  done: [],
  cancelled: []
};

export function canTransitionRepair(from: RepairStatus, to: RepairStatus): boolean {
  return from === to || transitions[from].includes(to);
}

export function moneyToCents(value: string | number): number {
  const raw = String(value);
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(raw);
  if (!match) throw new Error('Invalid monetary value stored in database.');
  return Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
}

export function centsToMoney(value: number): string {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid monetary amount.');
  return `${Math.floor(value / 100)}.${String(value % 100).padStart(2, '0')}`;
}

export function paymentStatus(totalCents: number, paidCents: number): 'unpaid' | 'partial' | 'paid' {
  if (totalCents === 0) return 'paid';
  if (paidCents <= 0) return 'unpaid';
  return paidCents >= totalCents ? 'paid' : 'partial';
}
