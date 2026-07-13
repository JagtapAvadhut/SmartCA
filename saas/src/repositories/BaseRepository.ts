import { http, type PaginatedResult, type QueryParams } from '@/services/httpClient'

export type Entity = { id: string; archived?: boolean; createdAt?: string; updatedAt?: string }

const PATH: Record<string, string> = {
  clients: '/clients',
  companies: '/companies',
  employees: '/employees',
  invoices: '/invoices',
  payments: '/payments',
  documents: '/documents',
  tasks: '/tasks',
  notifications: '/notifications',
  roc: '/roc',
  compliance: '/compliance',
}

async function listAll<T>(path: string, params?: QueryParams): Promise<T[]> {
  const res = await http.get<PaginatedResult<T>>(path, {
    params: { page: 1, pageSize: 100000, ...params },
  })
  return res.data
}

export class BaseRepository<T extends Entity> {
  protected path: string
  protected searchFields: string[]

  constructor(collectionName: string, searchFields: string[] = []) {
    this.path = PATH[collectionName] || `/${collectionName}`
    this.searchFields = searchFields
  }

  async create(data: Partial<T> & { id?: string }): Promise<T> {
    return http.post<T>(this.path, data)
  }

  async update(id: string, data: Partial<T>): Promise<T> {
    return http.patch<T>(`${this.path}/${id}`, data)
  }

  async delete(id: string): Promise<boolean> {
    await http.del(`${this.path}/${id}`)
    return true
  }

  async findById(id: string): Promise<T | null> {
    try {
      return await http.get<T>(`${this.path}/${id}`)
    } catch {
      return null
    }
  }

  async findAll(params?: QueryParams): Promise<T[]> {
    return listAll<T>(this.path, params)
  }

  async search(query: string, params?: QueryParams): Promise<T[]> {
    return listAll<T>(this.path, { ...params, search: query })
  }

  async filter(filter: Record<string, unknown>, params?: QueryParams): Promise<T[]> {
    const rows = await listAll<T>(this.path, params)
    return rows.filter((row) =>
      Object.entries(filter).every(([k, expected]) => {
        if (expected === undefined || expected === null || expected === '') return true
        return (row as Record<string, unknown>)[k] === expected
      }),
    )
  }

  async archive(id: string): Promise<T> {
    await http.post(`${this.path}/${id}/archive`)
    try {
      return await http.get<T>(`${this.path}/${id}`)
    } catch {
      return { id, archived: true } as unknown as T
    }
  }

  async restore(id: string): Promise<T> {
    await http.post(`${this.path}/${id}/restore`)
    return http.get<T>(`${this.path}/${id}`)
  }

  async duplicate(id: string, overrides: Partial<T> = {}): Promise<T> {
    const copy = await http.post<T>(`${this.path}/${id}/duplicate`)
    if (Object.keys(overrides).length) {
      return http.patch<T>(`${this.path}/${copy.id}`, overrides)
    }
    return copy
  }

  async count(filter?: Record<string, unknown>): Promise<number> {
    if (!filter) {
      const res = await http.get<PaginatedResult<T>>(this.path, { params: { page: 1, pageSize: 1 } })
      return res.total
    }
    return (await this.filter(filter)).length
  }
}
