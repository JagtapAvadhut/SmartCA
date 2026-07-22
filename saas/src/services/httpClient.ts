const TOKEN_KEY = 'smart-ca-token'
const AUTH_PERSIST_KEY = 'smart-ca-auth'
const TIMEOUT_MS = 15_000

function defaultApiBase(): string {
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const host = window.location.hostname
    // Keep API host aligned with the page host (localhost vs 127.0.0.1) to avoid CORS/session quirks.
    if (host === 'localhost' || host === '127.0.0.1') {
      return `http://${host}:8080/api/v1`
    }
  }
  return 'http://localhost:8080/api/v1'
}

/** Sync bearer token from zustand persist blob before any request (avoids boot race). */
function syncTokenFromPersist() {
  try {
    if (localStorage.getItem(TOKEN_KEY)) return
    const raw = localStorage.getItem(AUTH_PERSIST_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as { state?: { token?: string } }
    const token = parsed?.state?.token
    if (token) localStorage.setItem(TOKEN_KEY, token)
  } catch {
    /* ignore */
  }
}

if (typeof window !== 'undefined') {
  syncTokenFromPersist()
}

export function setAuthToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token)
  } else {
    localStorage.removeItem(TOKEN_KEY)
  }
}

export function getAuthToken(): string | null {
  try {
    syncTokenFromPersist()
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function getApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_BASE_URL as string | undefined
  // Empty or unset → native default. Explicit "/api/v1" is for same-origin Docker/nginx proxy.
  const base = raw !== undefined && raw.trim() !== '' ? raw.trim() : defaultApiBase()
  return base.replace(/\/$/, '')
}

export interface QueryParams {
  page?: number
  pageSize?: number
  search?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  status?: string
  [key: string]: string | number | undefined
}

export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

/** @deprecated No-op — network latency replaces simulated delays. */
export function simulateDelay(_ms = 300): Promise<void> {
  return Promise.resolve()
}

interface ApiEnvelope<T = unknown> {
  success: boolean
  data?: T
  meta?: {
    requestId?: string
    pagination?: {
      page: number
      pageSize: number
      totalItems: number
      totalPages: number
    }
  }
  error?: {
    code?: string
    message?: string
    details?: unknown
  }
  message?: string
}

export class ApiError extends Error {
  status: number
  code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

function handleUnauthorized() {
  setAuthToken(null)
  try {
    localStorage.removeItem(AUTH_PERSIST_KEY)
  } catch {
    /* ignore */
  }
  if (typeof window === 'undefined') return
  const path = window.location.pathname
  if (path === '/login' || path.startsWith('/login?')) return
  window.location.assign('/login')
}

/** Map frontend QueryParams to backend query string (sortOrder → sortDir). */
export function buildQueryString(params?: QueryParams): string {
  if (!params) return ''
  const sp = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    if (key === 'sortOrder') {
      sp.set('sortDir', String(value))
      continue
    }
    sp.set(key, String(value))
  }
  const qs = sp.toString()
  return qs ? `?${qs}` : ''
}

type RequestOptions = {
  params?: QueryParams
  body?: unknown
  signal?: AbortSignal
  /** When true, skip 401 redirect (e.g. login failures). */
  skipAuthRedirect?: boolean
  /** Override default request timeout (ms). */
  timeoutMs?: number
}

async function request<T>(
  method: string,
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const controller = new AbortController()
  const timeoutMs = options.timeoutMs ?? TIMEOUT_MS
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  const outer = options.signal
  if (outer) {
    if (outer.aborted) controller.abort()
    else outer.addEventListener('abort', () => controller.abort(), { once: true })
  }

  const url = `${getApiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}${buildQueryString(options.params)}`
  const headers: Record<string, string> = {
    Accept: 'application/json',
  }
  const token = getAuthToken()
  const sentAuth = Boolean(token)
  if (token) headers.Authorization = `Bearer ${token}`
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'

  let res: Response
  try {
    res = await fetch(url, {
      method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    })
  } catch (err) {
    clearTimeout(timeout)
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError('Request timed out. Check your connection and try again.', 408, 'TIMEOUT')
    }
    const raw = err instanceof Error ? err.message : 'Network error'
    // Browsers surface CORS + connection failures as TypeError "Failed to fetch".
    if (/failed to fetch|networkerror|load failed|err_connection|err_failed/i.test(raw)) {
      if (import.meta.env.DEV) {
        console.error('[Smart CA] API unreachable or blocked by CORS', {
          url,
          apiBase: getApiBaseUrl(),
          pageOrigin: typeof window !== 'undefined' ? window.location.origin : undefined,
          cause: raw,
        })
      }
      throw new ApiError(
        'Unable to reach the Smart CA API. Confirm the Go backend is running and that this page origin is allowed (http://localhost:5173 and http://127.0.0.1:5173).',
        0,
        'NETWORK',
      )
    }
    throw new ApiError(raw, 0, 'NETWORK')
  }
  clearTimeout(timeout)

  let envelope: ApiEnvelope<T> | null = null
  const text = await res.text()
  if (text) {
    try {
      envelope = JSON.parse(text) as ApiEnvelope<T>
    } catch {
      throw new ApiError(text.slice(0, 200) || res.statusText || 'Invalid response', res.status)
    }
  }

  if (res.status === 401 && !options.skipAuthRedirect && sentAuth) {
    handleUnauthorized()
  }

  if (!res.ok || envelope?.success === false) {
    const message =
      envelope?.error?.message ||
      envelope?.message ||
      res.statusText ||
      `Request failed (${res.status})`
    throw new ApiError(message, res.status, envelope?.error?.code)
  }

  if (!envelope) {
    return undefined as T
  }

  const pagination = envelope.meta?.pagination
  if (pagination && Array.isArray(envelope.data)) {
    return {
      data: envelope.data,
      total: pagination.totalItems,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: pagination.totalPages,
    } as T
  }

  return envelope.data as T
}

export const http = {
  get<T>(path: string, options?: RequestOptions): Promise<T> {
    return request<T>('GET', path, options)
  },
  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>('POST', path, { ...options, body })
  },
  patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>('PATCH', path, { ...options, body })
  },
  put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>('PUT', path, { ...options, body })
  },
  del<T>(path: string, options?: RequestOptions): Promise<T> {
    return request<T>('DELETE', path, options)
  },
}

export function httpGetList<T>(path: string, params?: QueryParams): Promise<PaginatedResult<T>> {
  return http.get<PaginatedResult<T>>(path, { params })
}
