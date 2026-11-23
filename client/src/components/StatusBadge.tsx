import type { RepairStatus } from '../lib/types';
const labels: Record<RepairStatus, string> = { pending: 'Pending', approved: 'Approved', in_progress: 'In progress', checking: 'Checking', done: 'Completed', cancelled: 'Cancelled' };
const styles: Record<RepairStatus, string> = {
  pending: 'bg-amber-50 text-amber-700 ring-amber-200', approved: 'bg-blue-50 text-blue-700 ring-blue-200',
  in_progress: 'bg-violet-50 text-violet-700 ring-violet-200', checking: 'bg-cyan-50 text-cyan-700 ring-cyan-200',
  done: 'bg-emerald-50 text-emerald-700 ring-emerald-200', cancelled: 'bg-rose-50 text-rose-700 ring-rose-200'
};
export default function StatusBadge({ status }: { status: RepairStatus }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${styles[status]}`}>{labels[status]}</span>;
}
