import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ShieldCheck, Wrench } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../lib/api';

export default function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/" replace />;
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setBusy(true);
    try { await login(username, password); navigate('/', { replace: true }); }
    catch (err) { setError(getErrorMessage(err)); }
    finally { setBusy(false); }
  }
  return <div className="grid min-h-screen bg-white lg:grid-cols-2">
    <div className="relative hidden overflow-hidden bg-slate-950 p-12 text-white lg:flex lg:flex-col lg:justify-between"><div className="absolute -right-20 -top-20 h-96 w-96 rounded-full bg-blue-600/30 blur-3xl" /><div className="absolute -bottom-20 -left-20 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl" /><div className="relative flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-500"><Wrench /></div><span className="text-xl font-extrabold">TechFix</span></div><div className="relative max-w-lg"><p className="mb-5 text-xs font-bold uppercase tracking-[.22em] text-blue-300">Repair operations, simplified</p><h1 className="text-5xl font-extrabold leading-tight tracking-tight">Keep every repair moving forward.</h1><p className="mt-6 max-w-md text-base leading-7 text-slate-300">Manage customers, service jobs, materials and payments from one clear workspace.</p></div><div className="relative flex items-center gap-2 text-sm text-slate-400"><ShieldCheck size={17} /> Secure team access</div></div>
    <div className="flex items-center justify-center px-6 py-12"><div className="w-full max-w-md"><div className="mb-10 lg:hidden"><div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-blue-600 text-white"><Wrench /></div><h1 className="text-2xl font-extrabold">TechFix</h1></div><p className="text-sm font-bold uppercase tracking-[.16em] text-blue-600">Welcome back</p><h2 className="mt-2 text-3xl font-extrabold tracking-tight text-ink">Sign in to your workspace</h2><p className="mt-3 text-sm leading-6 text-slate-500">Enter your account details to manage repair operations.</p>
      <form onSubmit={submit} className="mt-8 space-y-5"><div><label htmlFor="login-username" className="label">Username</label><input id="login-username" className="field" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required /></div><div><label htmlFor="login-password" className="label">Password</label><input id="login-password" className="field" type="password" autoComplete="current-password" maxLength={72} value={password} onChange={(e) => setPassword(e.target.value)} required /></div>{error && <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}<button className="btn-primary w-full py-3" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button></form>
      
    </div></div>
  </div>;
}
