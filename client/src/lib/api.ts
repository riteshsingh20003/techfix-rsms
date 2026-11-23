import axios from 'axios';

function readCsrfCookie(): string | undefined {
  const cookieName = import.meta.env.PROD ? '__Host-techfix_csrf=' : 'techfix_csrf=';
  const item = document.cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith(cookieName));
  if (!item) return undefined;
  try { return decodeURIComponent(item.slice(cookieName.length)); }
  catch { return undefined; }
}

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15_000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use((config) => {
  const method = (config.method ?? 'get').toLowerCase();
  if (!['get', 'head', 'options'].includes(method)) {
    const csrf = readCsrfCookie();
    if (csrf) config.headers.set('X-CSRF-Token', csrf);
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !String(error.config?.url ?? '').includes('/auth/login')) {
      window.dispatchEvent(new Event('techfix:unauthorized'));
    }
    return Promise.reject(error);
  }
);

export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) return error.response?.data?.message || (error.code === 'ECONNABORTED' ? 'The server took too long to respond.' : 'Unable to connect to the server.');
  return error instanceof Error ? error.message : 'Something went wrong.';
}
