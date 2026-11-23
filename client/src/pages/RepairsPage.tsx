import { useMemo, useState, type FormEvent } from 'react';
import { Plus, Search, CreditCard, ExternalLink, ReceiptText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '../lib/api';
import type { Client, PageResult, Repair, RepairStatus, Service } from '../lib/types';
import { EmptyState, ErrorState, LoadingState } from '../components/Feedback';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';
import StatusBadge from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';

const statuses: RepairStatus[] = ['pending', 'approved', 'in_progress', 'checking', 'done', 'cancelled'];
const label: Record<RepairStatus, string> = { pending: 'Pending', approved: 'Approved', in_progress: 'In progress', checking: 'Checking', done: 'Completed', cancelled: 'Cancelled' };
const nextStatuses: Record<RepairStatus, RepairStatus[]> = {
  pending: ['approved', 'cancelled'], approved: ['in_progress', 'cancelled'],
  in_progress: ['checking', 'cancelled'], checking: ['in_progress', 'done', 'cancelled'], done: [], cancelled: []
};
const money = (value: number | string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0);
type MaterialDraft = { name: string; cost: string };
type PaymentDraft = { idempotencyKey: string; amount: string; method: 'cash' | 'card' | 'upi' | 'bank_transfer'; reference: string };
const newPaymentDraft = (amount = ''): PaymentDraft => ({ idempotencyKey: crypto.randomUUID(), amount, method: 'upi', reference: '' });

export default function RepairsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [serviceSearch, setServiceSearch] = useState('');
  const [serviceIds, setServiceIds] = useState<number[]>([]);
  const [selectedServices, setSelectedServices] = useState<Record<number, Service>>({});
  const [remarks, setRemarks] = useState('');
  const [material, setMaterial] = useState<MaterialDraft>({ name: '', cost: '' });
  const [error, setError] = useState('');
  const [statusError, setStatusError] = useState('');
  const [paymentRepair, setPaymentRepair] = useState<Repair | null>(null);
  const [paymentDraft, setPaymentDraft] = useState<PaymentDraft>(() => newPaymentDraft());
  const [paymentError, setPaymentError] = useState('');

  const repairs = useQuery({ queryKey: ['repairs', search, status, page], queryFn: async () => (await api.get('/repairs', { params: { search, status, page, pageSize: 20 } })).data.data as PageResult<Repair> });
  // Searchable option lists are independently paginated and capped at 100 rows per request.
  const clients = useQuery({ queryKey: ['clients', 'repair-options', clientSearch], enabled: open, queryFn: async () => (await api.get('/clients', { params: { search: clientSearch, page: 1, pageSize: 100 } })).data.data as PageResult<Client> });
  const services = useQuery({ queryKey: ['services', 'repair-options', serviceSearch], enabled: open, queryFn: async () => (await api.get('/services', { params: { search: serviceSearch, page: 1, pageSize: 100 } })).data.data as PageResult<Service> });

  const refreshData = () => {
    void qc.invalidateQueries({ queryKey: ['repairs'] });
    void qc.invalidateQueries({ queryKey: ['dashboard'] });
  };
  const create = useMutation({
    mutationFn: () => api.post('/repairs', {
      clientId: Number(clientId), serviceIds, remarks,
      materials: material.name.trim() ? [{ name: material.name.trim(), cost: Number(material.cost || 0) }] : []
    }),
    onSuccess: () => { refreshData(); setOpen(false); setError(''); setClientId(''); setClientSearch(''); setServiceSearch(''); setServiceIds([]); setSelectedServices({}); setRemarks(''); setMaterial({ name: '', cost: '' }); },
    onError: (reason) => setError(getErrorMessage(reason))
  });
  const updateStatus = useMutation({
    mutationFn: ({ id, next }: { id: number; next: RepairStatus }) => api.patch(`/repairs/${id}/status`, { status: next }),
    onSuccess: () => { setStatusError(''); refreshData(); },
    onError: (reason) => setStatusError(getErrorMessage(reason))
  });
  const recordPayment = useMutation({
    mutationFn: () => {
      if (!paymentRepair) throw new Error('Select a repair before recording a payment.');
      return api.post(`/repairs/${paymentRepair.id}/payments`, { idempotencyKey: paymentDraft.idempotencyKey, amount: Number(paymentDraft.amount), method: paymentDraft.method, reference: paymentDraft.reference.trim() });
    },
    onSuccess: () => { refreshData(); setPaymentRepair(null); setPaymentDraft(newPaymentDraft()); setPaymentError(''); },
    onError: (reason) => setPaymentError(getErrorMessage(reason))
  });
  const selectedTotal = useMemo(() => Object.values(selectedServices).reduce((sum, item) => sum + Number(item.price), 0), [selectedServices]);
  function submit(e: FormEvent) { e.preventDefault(); setError(''); create.mutate(); }
  function submitPayment(e: FormEvent) { e.preventDefault(); setPaymentError(''); recordPayment.mutate(); }
  function toggleService(service: Service) {
    setServiceIds((current) => current.includes(service.id) ? current.filter((value) => value !== service.id) : [...current, service.id]);
    setSelectedServices((current) => {
      const next = { ...current };
      if (next[service.id]) delete next[service.id]; else next[service.id] = service;
      return next;
    });
  }
  function removeSelectedService(id: number) {
    setServiceIds((current) => current.filter((value) => value !== id));
    setSelectedServices((current) => { const next = { ...current }; delete next[id]; return next; });
  }

  return <div className="space-y-6">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm text-slate-500">Track every job from intake to handover</p><h2 className="mt-1 text-2xl font-extrabold text-ink">Repair jobs</h2></div><button type="button" className="btn-primary" onClick={() => { setOpen(true); setError(''); }}><Plus size={17} /> Create repair</button></div>
    <div className="card overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 md:flex-row"><div className="relative flex-1"><Search aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input aria-label="Search repair code or customer" className="field pl-9" placeholder="Search repair code or customer…" value={search} maxLength={100} onChange={(e) => { setSearch(e.target.value); setPage(1); }} /></div><label className="sr-only" htmlFor="repair-status-filter">Filter repairs by status</label><select id="repair-status-filter" className="field md:max-w-52" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">All statuses</option>{statuses.map((item) => <option key={item} value={item}>{label[item]}</option>)}</select></div>
      {statusError && <p role="alert" className="border-b border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">{statusError}</p>}
      {repairs.isLoading ? <LoadingState /> : repairs.isError ? <div className="p-4"><ErrorState message={getErrorMessage(repairs.error)} onRetry={() => void repairs.refetch()} /></div> : repairs.data!.items.length === 0 ? <EmptyState title="No repair jobs found" detail="Create a repair job or change the current filters." /> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400"><tr><th scope="col" className="px-5 py-3">Repair / Customer</th><th scope="col" className="px-5 py-3">Date</th><th scope="col" className="px-5 py-3">Status</th><th scope="col" className="px-5 py-3">Amount</th><th scope="col" className="px-5 py-3">Payment</th><th scope="col" className="px-5 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">
        {repairs.data!.items.map((repair) => <tr key={repair.id} className="hover:bg-slate-50/70">
          <td className="px-5 py-4"><p className="font-bold text-slate-800">{repair.code}</p><p className="mt-1 text-xs text-slate-500">{repair.clientName} · {repair.clientPhone}</p></td>
          <td className="px-5 py-4 text-slate-500">{new Date(repair.createdAt).toLocaleDateString()}</td>
          <td className="px-5 py-4">{nextStatuses[repair.status].length > 0 ? <select aria-label={`Status for ${repair.code}`} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-600" value={repair.status} disabled={updateStatus.isPending} onChange={(e) => updateStatus.mutate({ id: repair.id, next: e.target.value as RepairStatus })}><option value={repair.status}>{label[repair.status]}</option>{nextStatuses[repair.status].map((item) => <option key={item} value={item}>{label[item]}</option>)}</select> : <StatusBadge status={repair.status} />}</td>
          <td className="px-5 py-4 font-bold text-slate-800">{money(repair.totalAmount)}</td>
          <td className="px-5 py-4"><div><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${repair.paymentStatus === 'paid' ? 'bg-emerald-50 text-emerald-700' : repair.paymentStatus === 'partial' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>{repair.paymentStatus === 'paid' ? 'Paid' : repair.paymentStatus === 'partial' ? 'Part paid' : 'Unpaid'}</span><p className="mt-1 text-xs text-slate-400">Due {money(repair.outstandingBalance ?? repair.totalAmount)}</p></div></td>
          <td className="px-5 py-4"><div className="flex justify-end gap-1"><Link to={`/track?code=${encodeURIComponent(repair.code)}`} aria-label={`Public tracking for ${repair.code}`} title="Public tracking view" className="rounded-lg p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-600"><ExternalLink size={15} /></Link>{isAdmin && repair.status === 'done' && Number(repair.outstandingBalance ?? 0) > 0 && <button type="button" aria-label={`Record payment for ${repair.code}`} title="Record payment" onClick={() => { setPaymentRepair(repair); setPaymentDraft(newPaymentDraft(String(repair.outstandingBalance ?? repair.totalAmount))); setPaymentError(''); }} className="rounded-lg p-2 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"><ReceiptText size={15} /></button>}</div></td>
        </tr>)}
      </tbody></table></div>}
      {repairs.data && <Pagination page={repairs.data.page} totalPages={repairs.data.totalPages} total={repairs.data.total} onPageChange={setPage} />}
    </div>

    {open && <Modal title="Create repair job" onClose={() => setOpen(false)} wide><form onSubmit={submit} className="space-y-5">
      <div><label htmlFor="repair-client-search" className="label">Find customer</label><input id="repair-client-search" className="field" maxLength={100} placeholder="Search name, phone or email…" value={clientSearch} onChange={(e) => { setClientSearch(e.target.value); setClientId(''); }} /><label htmlFor="repair-customer" className="label mt-3">Customer *</label><select id="repair-customer" className="field" required value={clientId} onChange={(e) => setClientId(e.target.value)}><option value="">Select a customer</option>{clients.data?.items.map((client) => <option key={client.id} value={client.id}>{client.firstName} {client.lastName} · {client.phone}</option>)}</select>{clients.isLoading && <p className="mt-2 text-xs text-slate-500">Loading customers…</p>}{clients.isError && <p className="mt-2 text-xs text-rose-600">Unable to load customers. Retry after checking the connection.</p>}{clients.data?.total === 0 && <p className="mt-2 text-xs text-amber-700">{clientSearch ? 'No matching customers found. Try another search.' : 'An administrator must add a customer before creating a repair.'}</p>}{clients.data && clients.data.total > clients.data.items.length && <p className="mt-1 text-xs text-slate-400">More results may exist; refine the customer search to find the required record.</p>}</div>
      <fieldset><legend className="label">Services * (select at least one)</legend><label htmlFor="repair-service-search" className="sr-only">Search services</label><input id="repair-service-search" className="field mb-2" maxLength={100} placeholder="Search services…" value={serviceSearch} onChange={(e) => setServiceSearch(e.target.value)} /><div className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-slate-200 p-3">{services.data?.items.map((service) => <label key={service.id} className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-slate-50"><span className="flex items-center gap-3"><input type="checkbox" checked={serviceIds.includes(service.id)} onChange={() => toggleService(service)} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" /><span className="text-sm font-medium text-slate-700">{service.name}</span></span><span className="text-sm font-semibold text-slate-600">{money(service.price)}</span></label>)}{Object.values(selectedServices).length > 0 && <div className="mt-2 flex flex-wrap gap-2" aria-label="Selected services">{Object.values(selectedServices).map((item) => <button key={item.id} type="button" className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100" onClick={() => removeSelectedService(item.id)} aria-label={`Remove ${item.name}`}>{item.name} ×</button>)}</div>}{services.isLoading && <p className="p-2 text-sm text-slate-500">Loading services…</p>}{services.data?.total === 0 && <p className="p-2 text-sm text-amber-700">{serviceSearch ? 'No matching active services found. Try another search.' : 'No active services are available. Ask an administrator to add one.'}</p>}{services.isError && <p className="p-2 text-sm text-rose-600">Unable to load services. Retry after checking the connection.</p>}</div>{services.data && services.data.total > services.data.items.length && <p className="mt-1 text-xs text-slate-400">More services may exist; refine the search to find the required item.</p>}</fieldset>
      <div className="grid gap-3 sm:grid-cols-2"><div><label htmlFor="repair-material-name" className="label">Material (optional)</label><input id="repair-material-name" className="field" maxLength={180} placeholder="e.g. Replacement cable" value={material.name} onChange={(e) => setMaterial({ ...material, name: e.target.value })} /></div><div><label htmlFor="repair-material-cost" className="label">Material cost (₹)</label><input id="repair-material-cost" className="field" type="number" min="0" max="1000000" step="0.01" placeholder="0.00" value={material.cost} onChange={(e) => setMaterial({ ...material, cost: e.target.value })} /></div></div>
      <div><label htmlFor="repair-remarks" className="label">Problem / remarks</label><textarea id="repair-remarks" className="field min-h-20" maxLength={3000} placeholder="Describe the reported issue or work required…" value={remarks} onChange={(e) => setRemarks(e.target.value)} /></div>
      <div className="flex items-center justify-between rounded-xl bg-blue-50 px-4 py-3"><span className="text-sm font-semibold text-blue-800">Estimated total</span><strong className="text-lg text-blue-800">{money(selectedTotal + (material.name.trim() ? Number(material.cost || 0) : 0))}</strong></div>
      {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
      <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button><button className="btn-primary" disabled={create.isPending || clients.isLoading || services.isLoading || !clientId || serviceIds.length === 0}>{create.isPending ? 'Creating…' : 'Create repair'}</button></div>
    </form></Modal>}

    {paymentRepair && <Modal title={`Record payment · ${paymentRepair.code}`} onClose={() => setPaymentRepair(null)}><form onSubmit={submitPayment} className="space-y-4">
      <div className="rounded-xl bg-slate-50 p-4"><div className="flex justify-between text-sm"><span className="text-slate-500">Total</span><strong>{money(paymentRepair.totalAmount)}</strong></div><div className="mt-2 flex justify-between text-sm"><span className="text-slate-500">Remaining balance</span><strong>{money(paymentRepair.outstandingBalance ?? paymentRepair.totalAmount)}</strong></div></div>
      <div><label htmlFor="payment-amount" className="label">Amount received (₹) *</label><input id="payment-amount" className="field" type="number" min="0.01" max={Number(paymentRepair.outstandingBalance ?? paymentRepair.totalAmount)} step="0.01" required value={paymentDraft.amount} onChange={(e) => setPaymentDraft({ ...paymentDraft, amount: e.target.value })} /></div>
      <div><label htmlFor="payment-method" className="label">Payment method *</label><select id="payment-method" className="field" value={paymentDraft.method} onChange={(e) => setPaymentDraft({ ...paymentDraft, method: e.target.value as PaymentDraft['method'] })}><option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option><option value="bank_transfer">Bank transfer</option></select></div>
      <div><label htmlFor="payment-reference" className="label">Reference / transaction ID</label><input id="payment-reference" className="field" maxLength={120} value={paymentDraft.reference} onChange={(e) => setPaymentDraft({ ...paymentDraft, reference: e.target.value })} /></div>
      {paymentError && <p role="alert" className="text-sm text-rose-600">{paymentError}</p>}
      <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setPaymentRepair(null)}>Cancel</button><button className="btn-primary" disabled={recordPayment.isPending || !paymentDraft.amount || Number(paymentDraft.amount) <= 0}>{recordPayment.isPending ? 'Recording…' : <><CreditCard size={16} /> Record payment</>}</button></div>
    </form></Modal>}
  </div>;
}
