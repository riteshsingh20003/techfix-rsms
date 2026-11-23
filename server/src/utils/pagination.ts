export interface PageWindow {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  offset: number;
}

/** Clamp a requested page after counting results; callers still validate inputs at the HTTP boundary. */
export function pageWindow(total: number, requestedPage: number, pageSize: number): PageWindow {
  if (!Number.isSafeInteger(total) || total < 0) throw new Error('Invalid result count for pagination.');
  if (!Number.isSafeInteger(requestedPage) || requestedPage < 1) throw new Error('Invalid page number.');
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new Error('Invalid page size.');
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);
  return { page, pageSize, total, totalPages, offset: (page - 1) * pageSize };
}
