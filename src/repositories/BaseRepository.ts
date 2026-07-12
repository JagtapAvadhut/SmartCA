import { getCollection, type CollectionKey } from '@/db'
import type { QueryOptions, PaginatedResult } from '@/db'

export type Entity = { id: string; archived?: boolean; createdAt?: string; updatedAt?: string }

export class BaseRepository<T extends Entity> {
  protected collectionName: CollectionKey
  protected searchFields: string[]

  constructor(collectionName: CollectionKey, searchFields: string[] = []) {
    this.collectionName = collectionName
    this.searchFields = searchFields
  }

  protected col() {
    return getCollection<T>(this.collectionName)
  }

  create(data: Partial<T> & { id?: string }): T {
    return this.col().insert(data)
  }

  update(id: string, data: Partial<T>): T {
    return this.col().update(id, data)
  }

  delete(id: string): boolean {
    return this.col().delete(id)
  }

  findById(id: string): T | null {
    return this.col().findById(id)
  }

  findAll(options: QueryOptions = {}): T[] {
    return this.col().find({ ...options, pageSize: options.pageSize || 100000 })
  }

  search(query: string, options: QueryOptions = {}): T[] {
    return this.col().find({
      ...options,
      search: query,
      searchFields: this.searchFields,
      pageSize: options.pageSize || 100000,
    })
  }

  filter(filter: Record<string, unknown>, options: QueryOptions = {}): T[] {
    return this.col().find({ ...options, filter, pageSize: options.pageSize || 100000 })
  }

  sort(sortBy: string, sortOrder: 'asc' | 'desc' = 'asc', options: QueryOptions = {}): T[] {
    return this.col().find({ ...options, sortBy, sortOrder, pageSize: options.pageSize || 100000 })
  }

  paginate(options: QueryOptions = {}): PaginatedResult<T> {
    return this.col().findMany({
      ...options,
      searchFields: options.searchFields || this.searchFields,
    })
  }

  archive(id: string): T {
    return this.col().archive(id)
  }

  restore(id: string): T {
    return this.col().restore(id)
  }

  duplicate(id: string, overrides: Partial<T> = {}): T {
    return this.col().duplicate(id, overrides)
  }

  count(filter?: Record<string, unknown>): number {
    return this.col().count({ filter })
  }
}
