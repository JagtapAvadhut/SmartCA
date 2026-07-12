import { http, type QueryParams, type PaginatedResult } from '@/services/httpClient'

export function createCrudService<T extends { id: string }>(
  path: string,
  options?: {
    beforeCreate?: (data: Partial<T>) => Partial<T>
  },
) {
  const base = path.startsWith('/') ? path : `/${path}`

  return {
    async getAll(params?: QueryParams): Promise<PaginatedResult<T>> {
      return http.get<PaginatedResult<T>>(base, { params })
    },

    async getById(id: string): Promise<T> {
      return http.get<T>(`${base}/${id}`)
    },

    async create(data: Partial<T>): Promise<T> {
      const prepared = options?.beforeCreate ? options.beforeCreate(data) : data
      return http.post<T>(base, prepared)
    },

    async update(id: string, data: Partial<T>): Promise<T> {
      return http.patch<T>(`${base}/${id}`, data)
    },

    /**
     * Permanent delete (Go: DELETE /{path}/{id}).
     * Soft-delete / Recycle Bin uses archive().
     */
    async delete(id: string): Promise<{ success: boolean }> {
      await http.del(`${base}/${id}`)
      return { success: true }
    },

    /** Soft-delete (Go: POST /{path}/{id}/archive). */
    async archive(id: string): Promise<T> {
      await http.post(`${base}/${id}/archive`)
      try {
        return await http.get<T>(`${base}/${id}`)
      } catch {
        return { id, archived: true } as unknown as T
      }
    },

    async restore(id: string): Promise<T> {
      await http.post(`${base}/${id}/restore`)
      return http.get<T>(`${base}/${id}`)
    },

    async duplicate(id: string, overrides?: Partial<T>): Promise<T> {
      const copy = await http.post<T>(`${base}/${id}/duplicate`)
      if (overrides && Object.keys(overrides).length > 0) {
        return http.patch<T>(`${base}/${copy.id}`, overrides)
      }
      return copy
    },

    async find(filter?: Record<string, unknown>): Promise<T[]> {
      const params: QueryParams = { page: 1, pageSize: 100000 }
      if (filter) {
        for (const [k, v] of Object.entries(filter)) {
          if (v !== undefined && v !== null && v !== '') {
            params[k] = typeof v === 'number' ? v : String(v)
          }
        }
      }
      const res = await http.get<PaginatedResult<T>>(base, { params })
      // Backend list only supports status as a first-class filter; apply rest client-side.
      if (!filter) return res.data
      return res.data.filter((row) =>
        Object.entries(filter).every(([k, expected]) => {
          if (expected === undefined || expected === null || expected === '') return true
          return (row as Record<string, unknown>)[k] === expected
        }),
      )
    },

    async count(filter?: Record<string, unknown>): Promise<number> {
      if (!filter || Object.keys(filter).length === 0) {
        const res = await http.get<PaginatedResult<T>>(base, { params: { page: 1, pageSize: 1 } })
        return res.total
      }
      const rows = await this.find(filter)
      return rows.length
    },
  }
}
