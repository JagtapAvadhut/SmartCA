const TOKEN_KEY = 'smart-ca-token'

/** Demo auth token helpers — no real HTTP client in v1.0. */
export function setAuthToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token)
  } else {
    localStorage.removeItem(TOKEN_KEY)
  }
}

export function simulateDelay(ms = 300): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
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

export function paginate<T>(
  data: T[],
  params: QueryParams = {}
): { data: T[]; total: number; page: number; pageSize: number; totalPages: number } {
  const page = params.page || 1
  const pageSize = params.pageSize || 10
  let filtered = [...data]

  if (params.search) {
    const q = params.search.toLowerCase()
    filtered = filtered.filter((item) =>
      Object.values(item as Record<string, unknown>).some((v) =>
        String(v).toLowerCase().includes(q)
      )
    )
  }

  if (params.status) {
    filtered = filtered.filter(
      (item) => (item as Record<string, unknown>).status === params.status
    )
  }

  if (params.sortBy) {
    const key = params.sortBy
    const order = params.sortOrder === 'desc' ? -1 : 1
    filtered.sort((a, b) => {
      const aVal = (a as Record<string, unknown>)[key]
      const bVal = (b as Record<string, unknown>)[key]
      if (aVal == null) return 1
      if (bVal == null) return -1
      return String(aVal).localeCompare(String(bVal)) * order
    })
  }

  const total = filtered.length
  const totalPages = Math.ceil(total / pageSize)
  const start = (page - 1) * pageSize
  const paginatedData = filtered.slice(start, start + pageSize)

  return { data: paginatedData, total, page, pageSize, totalPages }
}
