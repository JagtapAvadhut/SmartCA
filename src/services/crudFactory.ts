import { getCollection, type CollectionKey } from '@/db'
import type { QueryOptions, PaginatedResult } from '@/db'
import { simulateDelay, type QueryParams } from '@/services/api'

function toQueryOptions(params?: QueryParams): QueryOptions {
  return {
    page: params?.page,
    pageSize: params?.pageSize,
    search: params?.search,
    sortBy: params?.sortBy,
    sortOrder: params?.sortOrder,
    filter: params?.status ? { status: params.status } : undefined,
    includeArchived: false,
  }
}

export function createCrudService<T extends { id: string }>(
  collectionName: CollectionKey,
  options?: {
    searchFields?: string[]
    idPrefix?: string
    beforeCreate?: (data: Partial<T>) => Partial<T>
  }
) {
  const col = () => getCollection<T>(collectionName)

  return {
    async getAll(params?: QueryParams): Promise<PaginatedResult<T>> {
      await simulateDelay()
      return col().findMany({
        ...toQueryOptions(params),
        searchFields: options?.searchFields,
      })
    },

    async getById(id: string): Promise<T> {
      await simulateDelay()
      const row = col().findById(id)
      if (!row) throw new Error('Record not found')
      return row
    },

    async create(data: Partial<T>): Promise<T> {
      await simulateDelay(300)
      const prepared = options?.beforeCreate ? options.beforeCreate(data) : data
      return col().insert(prepared as Partial<T> & { id?: string })
    },

    async update(id: string, data: Partial<T>): Promise<T> {
      await simulateDelay(300)
      return col().update(id, data)
    },

    async delete(id: string): Promise<{ success: boolean }> {
      await simulateDelay(200)
      col().delete(id)
      return { success: true }
    },

    async archive(id: string): Promise<T> {
      await simulateDelay(200)
      return col().archive(id)
    },

    async restore(id: string): Promise<T> {
      await simulateDelay(200)
      return col().restore(id)
    },

    async duplicate(id: string, overrides?: Partial<T>): Promise<T> {
      await simulateDelay(300)
      return col().duplicate(id, overrides)
    },

    async find(filter?: Record<string, unknown>): Promise<T[]> {
      await simulateDelay()
      return col().find({ filter, pageSize: 100000 })
    },

    async count(filter?: Record<string, unknown>): Promise<number> {
      await simulateDelay(100)
      return col().count({ filter })
    },
  }
}
