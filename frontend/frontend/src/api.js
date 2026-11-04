const BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'
export const tokenStore = {
  get: () => localStorage.getItem('token'),
  set: (t) => localStorage.setItem('token', t),
  clear: () => localStorage.removeItem('token'),
}
const bus = new EventTarget()
export const toast = (msg, kind = 'error') => bus.dispatchEvent(new CustomEvent('toast', { detail: { msg, kind, id: Math.random() } }))
export const on = (name, fn) => { const h = (e) => fn(e.detail); bus.addEventListener(name, h); return () => bus.removeEventListener(name, h) }
export class ApiError extends Error { constructor(m, status) { super(m); this.status = status } }

function message(status, body) {
  if (status === 429) return 'Too many requests, wait a minute and try again'
  if (status >= 500 && status !== 503) return 'Something went wrong on our side. Please try again.'
  const d = body?.detail
  if (Array.isArray(d)) return d.map((x) => x.msg || String(x)).join('. ')
  if (typeof d === 'string') return d
  if (typeof body?.error === 'string') return body.error
  return `Request failed (${status})`
}

export async function api(path, { method = 'GET', json, form, query, auth = true } = {}) {
  const url = new URL(BASE + path)
  Object.entries(query || {}).forEach(([k, v]) => v != null && v !== '' && url.searchParams.set(k, v))
  const headers = {}
  const token = tokenStore.get()
  if (auth && token) headers.Authorization = `Bearer ${token}`
  let body
  if (json) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(json) }
  if (form) body = form
  let res
  try { res = await fetch(url, { method, headers, body }) }
  catch { const m = 'Cannot reach the server. Check your connection.'; toast(m); throw new ApiError(m, 0) }
  const data = await res.json().catch(() => null)
  if (res.ok) return data
  const msg = message(res.status, data)
  if (auth && (res.status === 401 || (res.status === 403 && data?.detail === 'Not authenticated'))) {
    tokenStore.clear(); bus.dispatchEvent(new CustomEvent('expired')); throw new ApiError(msg, res.status)
  }
  if (res.status === 429 || res.status >= 500) toast(msg)
  throw new ApiError(msg, res.status)
}
