import { Link } from 'react-router-dom';
export default function NotFoundPage() {
  return <div className="grid min-h-screen place-items-center bg-canvas px-4"><div className="text-center"><p className="text-sm font-bold uppercase tracking-[.2em] text-blue-600">404 · Not found</p><h1 className="mt-3 text-3xl font-extrabold text-ink">This page went missing.</h1><p className="mt-2 text-sm text-slate-500">The page may have moved or the link may be incorrect.</p><Link className="btn-primary mt-6" to="/">Go to dashboard</Link></div></div>;
}
