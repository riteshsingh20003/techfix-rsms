import { useState, type FormEvent } from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { api, getErrorMessage } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export default function AccountPage() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const change = useMutation({
    mutationFn: () => api.post('/auth/change-password', { currentPassword, newPassword }),
    onSuccess: () => { setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setError(''); setMessage('Password changed successfully. Other active sessions have been signed out.'); },
    onError: (reason) => { setMessage(''); setError(getErrorMessage(reason)); }
  });
  function submit(event: FormEvent) {
    event.preventDefault(); setMessage(''); setError('');
    if (newPassword !== confirmPassword) { setError('The new password and confirmation do not match.'); return; }
    change.mutate();
  }
  return <div className="mx-auto max-w-2xl space-y-6">
    <div><p className="text-sm text-slate-500">Manage your sign-in credentials</p><h2 className="mt-1 text-2xl font-extrabold text-ink">Account security</h2></div>
    <section className="card p-5 sm:p-7">
      <div className="flex items-center gap-3 border-b border-slate-100 pb-5"><div className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-blue-600"><ShieldCheck size={20} /></div><div><h3 className="font-bold text-ink">Signed-in account</h3><p className="text-sm text-slate-500">{user?.firstName} {user?.lastName} · {user?.role}</p></div></div>
      <form onSubmit={submit} className="mt-5 space-y-4">
        <div><label htmlFor="current-password" className="label">Current password</label><input id="current-password" className="field" type="password" autoComplete="current-password" required minLength={1} maxLength={72} value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></div>
        <div><label htmlFor="new-password" className="label">New password</label><input id="new-password" className="field" type="password" autoComplete="new-password" required minLength={14} maxLength={72} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /><p className="mt-1 text-xs leading-5 text-slate-400">At least 14 characters, including uppercase, lowercase, a number and a symbol. Avoid common words.</p></div>
        <div><label htmlFor="confirm-password" className="label">Confirm new password</label><input id="confirm-password" className="field" type="password" autoComplete="new-password" required minLength={14} maxLength={72} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></div>
        {error && <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
        {message && <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p>}
        <button className="btn-primary" disabled={change.isPending}><KeyRound size={16} />{change.isPending ? 'Updating…' : 'Change password'}</button>
      </form>
    </section>
  </div>;
}
