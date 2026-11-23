export default function Pagination({ page, totalPages, total, onPageChange }: {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return <p className="px-5 py-3 text-xs text-slate-400" aria-live="polite">{total} {total === 1 ? 'record' : 'records'}</p>;
  return <nav className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row" aria-label="Pagination">
    <p className="text-xs text-slate-500" aria-live="polite">Page {page} of {totalPages} · {total} records</p>
    <div className="flex items-center gap-2">
      <button type="button" className="btn-secondary px-3 py-2 text-xs" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Previous</button>
      <button type="button" className="btn-secondary px-3 py-2 text-xs" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>Next</button>
    </div>
  </nav>;
}
