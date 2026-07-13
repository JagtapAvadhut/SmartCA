/**
 * API surface for Smart CA frontend.
 * Business data goes through the Go REST API via httpClient — never MockDatabase.
 */
export {
  setAuthToken,
  getAuthToken,
  getApiBaseUrl,
  simulateDelay,
  http,
  httpGetList,
  buildQueryString,
  ApiError,
  type QueryParams,
  type PaginatedResult,
} from './httpClient'

/** Client-side paginate helper (nav/settings search only — not business collections). */
export function paginate<T>(
  data: T[],
  params: import('./httpClient').QueryParams = {},
): import('./httpClient').PaginatedResult<T> {
  const page = params.page || 1
  const pageSize = params.pageSize || 10
  let filtered = [...data]

  if (params.search) {
    const q = params.search.toLowerCase()
    filtered = filtered.filter((item) =>
      Object.values(item as Record<string, unknown>).some((v) =>
        String(v).toLowerCase().includes(q),
      ),
    )
  }

  if (params.status) {
    filtered = filtered.filter(
      (item) => (item as Record<string, unknown>).status === params.status,
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
  const totalPages = Math.ceil(total / pageSize) || 1
  const start = (page - 1) * pageSize
  const paginatedData = filtered.slice(start, start + pageSize)

  return { data: paginatedData, total, page, pageSize, totalPages }
}
