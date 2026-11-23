import { useEffect, useState, type FormEvent } from 'react';
import { Activity, ArrowLeft, CheckCircle2, Search, Wrench } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { api, getErrorMessage } from '../lib/api';
import type { PublicRepairStatus, RepairStatus } from '../lib/types';
import StatusBadge from '../components/StatusBadge';

const steps: RepairStatus[] = ['pending', 'approved', 'in_progress', 'checking', 'done'];
const labels = ['Received', 'Approved', 'In progress', 'Quality check', 'Completed'];
export default function TrackingPage() {
  const [params] = useSearchParams();
  const [code, setCode] = useState(params.get('code') ?? '');
  const lookup = useMutation({ mutationFn: async (value: string) => (await api.get(`/repairs/track/${encodeURIComponent(value)}`)).data.data as PublicRepairStatus });
  useEffect(() => { const initial = params.get('code'); if (initial) lookup.mutate(initial); /* resolve an intentionally shared status URL */ }, []);
  function submit(event: FormEvent) { event.preventDefault(); lookup.mutate(code.trim().toUpperCase()); }
  const repair = lookup.data;
  return <div className="min-h-screen bg-canvas px-4 py-10"><div className="mx-auto max-w-3xl">
    <Link to="/login" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-blue-600"><ArrowLeft size={15} /> Back to TechFix</Link>
    <div className="mb-8 mt-8 text-center"><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20"><Wrench size={24} /></div><p className="mt-5 text-xs font-bold uppercase tracking-[.2em] text-blue-600">TechFix service desk</p><h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink">Track your repair</h1><p className="mt-3 text-sm text-slate-500">Enter the private repair reference shared by our service team to view its current status.</p></div>
    <form onSubmit={submit} className="card flex flex-col gap-3 p-4 sm:flex-row"><input className="field flex-1" placeholder="e.g. TF-20261122-…" value={code} maxLength={64} onChange={(event) => setCode(event.target.value)} required /><button className="btn-primary" disabled={lookup.isPending || !code.trim()}><Search size={16} />{lookup.isPending ? 'Checking…' : 'Check status'}</button></form>
    {lookup.isError && <div role="alert" className="mt-5 rounded-xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-700">{getErrorMessage(lookup.error)}</div>}
    {repair && <section className="card mt-6 overflow-hidden"><div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 p-5"><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Repair reference</p><h2 className="mt-1 text-xl font-extrabold text-ink">{repair.code}</h2><p className="mt-1 text-sm text-slate-500">Current service progress</p></div><StatusBadge status={repair.status} /></div>
      <div className="p-5"><h3 className="mb-4 font-bold text-ink">Repair progress</h3><div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{steps.map((step, index) => { const current = steps.indexOf(repair.status); const active = current >= index && repair.status !== 'cancelled'; return <div key={step} className={`rounded-xl border p-3 ${active ? 'border-blue-100 bg-blue-50 text-blue-700' : 'border-slate-100 bg-white text-slate-400'}`}><div className="flex items-center gap-2 text-xs font-semibold">{active ? <CheckCircle2 size={15} /> : <Activity size={15} />}{labels[index]}</div></div>; })}</div>{repair.status === 'cancelled' && <p className="mt-3 text-sm font-semibold text-rose-600">This repair request has been cancelled. Contact the service desk for assistance.</p>}</div>
      <div className="border-t border-slate-100 px-5 py-4 text-xs text-slate-400">Last updated {new Date(repair.updatedAt ?? repair.createdAt).toLocaleString()}</div>
    </section>}
    <p className="mt-8 text-center text-xs text-slate-400">For details about charges, personal information, or your receipt, contact the service desk directly.</p>
  </div></div>;
}
