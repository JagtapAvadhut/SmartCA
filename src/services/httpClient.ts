const TOKEN_KEY = 'smart-ca-token'
const DEFAULT_BASE = 'http://localhost:8080/api/v1'
const TIMEOUT_MS = 15_000

export function setAuthToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token)
  } else {
    localStorage.removeItem(TOKEN_KEY)
  }
}

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function getApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_BASE_URL as string | undefined
  const base = (raw && raw.trim()) || DEFAULT_BASE
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
    localStorage.removeItem('smart-ca-auth')
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
}

async function request<T>(
  method: string,
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
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
      throw new ApiError('Request timed out', 408)
    }
    throw new ApiError(err instanceof Error ? err.message : 'Network error', 0)
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

  if (res.status === 401 && !options.skipAuthRedirect) {
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
