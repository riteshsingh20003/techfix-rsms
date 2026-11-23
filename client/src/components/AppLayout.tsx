import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Activity, ChevronRight, ClipboardList, LayoutDashboard, LogOut, Menu, Settings, Users, Wrench, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const nav = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/repairs', label: 'Repair jobs', icon: ClipboardList },
  { to: '/clients', label: 'Customers', icon: Users },
  { to: '/services', label: 'Services', icon: Wrench },
  { to: '/account', label: 'Account security', icon: Settings }
];
export default function AppLayout() {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const title = nav.find((item) => item.to === location.pathname)?.label ?? 'TechFix';
  async function signOut() { try { await logout(); } catch { /* Local sign-out still proceeds if the API is unavailable. */ } finally { navigate('/login', { replace: true }); } }
  return <div className="min-h-screen bg-canvas lg:flex">
    {mobileOpen && <button aria-label="Close navigation" className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden" onClick={() => setMobileOpen(false)} />}
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-slate-100 bg-white transition-transform lg:static lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex h-20 items-center justify-between border-b border-slate-100 px-6">
        <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-blue-600 text-white"><Wrench size={20} /></div><div><p className="text-lg font-extrabold tracking-tight text-ink">TechFix</p><p className="text-[11px] font-semibold uppercase tracking-[.16em] text-slate-400">Service desk</p></div></div>
        <button className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 lg:hidden" onClick={() => setMobileOpen(false)}><X size={18} /></button>
      </div>
      <div className="px-4 pt-7"><p className="px-3 pb-3 text-[10px] font-bold uppercase tracking-[.18em] text-slate-400">Workspace</p><nav className="space-y-1">
        {nav.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} onClick={() => setMobileOpen(false)} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}><Icon size={18} />{label}</NavLink>)}
      </nav></div>
      <div className="mt-auto p-4"><div className="rounded-2xl bg-slate-50 p-4"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">{user?.firstName?.[0]}{user?.lastName?.[0]}</div><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-800">{user?.firstName} {user?.lastName}</p><p className="text-xs capitalize text-slate-500">{user?.role}</p></div></div><button onClick={signOut} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-600 hover:text-rose-600"><LogOut size={15} /> Sign out</button></div></div>
    </aside>
    <main className="min-w-0 flex-1">
      <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-slate-100 bg-white/90 px-4 backdrop-blur md:px-8">
        <div className="flex items-center gap-3"><button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden" onClick={() => setMobileOpen(true)}><Menu size={20} /></button><div><p className="text-xs font-medium text-slate-400">TechFix / Workspace</p><h1 className="text-lg font-bold text-ink">{title}</h1></div></div>
        <NavLink to="/track" className="hidden items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 sm:inline-flex"><Activity size={15} /> Public tracking <ChevronRight size={14} /></NavLink>
      </header>
      <div className="mx-auto max-w-7xl p-4 md:p-8"><Outlet /></div>
    </main>
  </div>;
}
