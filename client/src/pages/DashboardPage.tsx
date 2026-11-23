import { ArrowUpRight, BadgeCheck, CircleDollarSign, ClipboardList, Users, Wrench } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api, getErrorMessage } from '../lib/api';
import type { DashboardSummary } from '../lib/types';
import { EmptyState, ErrorState, LoadingState } from '../components/Feedback';
import StatusBadge from '../components/StatusBadge';

const money = (value: number | string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0);
export default function DashboardPage() {
  const query = useQuery({ queryKey: ['dashboard'], queryFn: async () => (await api.get('/dashboard/summary')).data.data as DashboardSummary });
  if (query.isLoading) return <LoadingState label="Loading your dashboard…" />;
  if (query.isError) return <ErrorState message={getErrorMessage(query.error)} onRetry={() => void query.refetch()} />;
  const data = query.data!;
  const stats = [
    { label: 'Total customers', value: data.clients, icon: Users, note: 'Registered customers' },
    { label: 'Active services', value: data.services, icon: Wrench, note: 'Available service items' },
    { label: 'Repair jobs', value: data.repairs, icon: ClipboardList, note: 'All recorded jobs' },
    { label: 'Outstanding', value: money(data.outstanding), icon: CircleDollarSign, note: 'Unpaid repair balances' }
  ];
  return <div className="space-y-8">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-sm text-slate-500">Your service desk at a glance</p><h2 className="mt-1 text-2xl font-extrabold tracking-tight text-ink">Good work starts with a clear view.</h2></div><Link to="/repairs" className="btn-primary">Manage repairs <ArrowUpRight size={16} /></Link></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{stats.map(({ label, value, icon: Icon, note }) => <div className="card p-5" key={label}><div className="flex items-center justify-between"><span className="text-sm font-semibold text-slate-500">{label}</span><span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-600"><Icon size={19} /></span></div><p className="mt-5 text-2xl font-extrabold tracking-tight text-ink">{value}</p><p className="mt-1 text-xs text-slate-400">{note}</p></div>)}</div>
    <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]"><section className="card overflow-hidden"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h3 className="font-bold text-ink">Recent repair jobs</h3><p className="mt-1 text-xs text-slate-400">Latest activity across your service desk</p></div><Link to="/repairs" className="text-xs font-bold text-blue-600 hover:text-blue-700">View all</Link></div>{data.recentRepairs.length === 0 ? <EmptyState title="No repair jobs yet" detail="Create your first repair job to see it here." /> : <div className="divide-y divide-slate-100">{data.recentRepairs.map((repair) => <div key={repair.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"><div><p className="font-semibold text-slate-800">{repair.code}</p><p className="mt-1 text-xs text-slate-500">{repair.clientName} · {new Date(repair.createdAt).toLocaleDateString()}</p></div><div className="flex items-center gap-3"><StatusBadge status={repair.status} /><span className="hidden text-sm font-bold text-slate-700 sm:block">{money(repair.totalAmount)}</span></div></div>)}</div>}</section>
      <section className="card p-5"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><BadgeCheck size={19} /></div><div><h3 className="font-bold text-ink">Repair pipeline</h3><p className="text-xs text-slate-400">Current job distribution</p></div></div><div className="mt-6 space-y-5">{[{ label: 'Pending', value: data.pending, color: 'bg-amber-400' }, { label: 'Approved', value: data.approved, color: 'bg-blue-500' }, { label: 'In progress', value: data.in_progress, color: 'bg-violet-500' }, { label: 'Checking', value: data.checking, color: 'bg-cyan-500' }, { label: 'Completed', value: data.completed, color: 'bg-emerald-500' }, { label: 'Cancelled', value: data.cancelled, color: 'bg-rose-400' }].map((item) => <div key={item.label}><div className="mb-2 flex justify-between text-sm"><span className="text-slate-600">{item.label}</span><strong>{item.value}</strong></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${item.color}`} style={{ width: `${data.repairs ? Math.min(100, (item.value / data.repairs) * 100) : 0}%` }} /></div></div>)}</div><Link to="/track" className="mt-7 flex items-center justify-between rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700"><span>Open public repair tracking</span><ArrowUpRight size={16} /></Link></section>
    </div>
  </div>;
}
