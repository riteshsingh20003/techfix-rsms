import { AlertCircle, LoaderCircle } from 'lucide-react';
export function LoadingState({ label = 'Loading data…' }: { label?: string }) {
  return <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" />{label}</div>;
}
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div className="flex flex-col items-center gap-3 rounded-2xl border border-rose-100 bg-rose-50 px-5 py-8 text-center text-sm text-rose-700"><AlertCircle className="h-5 w-5" /><p>{message}</p>{onRetry && <button className="btn-secondary" onClick={onRetry}>Try again</button>}</div>;
}
export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="py-12 text-center"><p className="font-semibold text-slate-700">{title}</p><p className="mt-1 text-sm text-slate-500">{detail}</p></div>;
}
