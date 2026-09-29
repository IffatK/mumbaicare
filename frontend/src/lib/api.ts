const TOKEN_KEY = 'mc_token';
/** The JWT is kept for the browser session only; all application data lives in MongoDB via the API. */
export const tokenStore = {
  get: () => sessionStorage.getItem(TOKEN_KEY),
  set: (t: string) => sessionStorage.setItem(TOKEN_KEY, t),
  clear: () => sessionStorage.removeItem(TOKEN_KEY),
};
export class ApiError extends Error { constructor(public status: number, msg: string, public issues?: any[]) { super(msg); } }
export async function api<T = any>(path: string, opts: { method?: string; body?: unknown; query?: Record<string, any> } = {}): Promise<T> {
  const qs = opts.query ? '?' + new URLSearchParams(Object.entries(opts.query).filter(([, v]) => v !== undefined && v !== '' && v !== null).map(([k, v]) => [k, String(v)])).toString() : '';
  const t = tokenStore.get();
  const res = await fetch(`/api${path}${qs}`, { method: opts.method ?? 'GET',
    headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== '/auth/login') { tokenStore.clear(); window.dispatchEvent(new Event('mc:logout')); }
  if (!res.ok) throw new ApiError(res.status, data.error ?? `Request failed (${res.status})`, data.issues);
  return data as T;
}
