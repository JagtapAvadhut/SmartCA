/**
 * Frontend Mock Database Engine
 * Behaves like a backend — CRUD + search + filter + sort + paginate + archive
 * Persists every mutation to localStorage.
 */

export type RecordId = string

export interface BaseRecord {
  id: RecordId
  archived?: boolean
  createdAt?: string
  updatedAt?: string
}

export interface QueryOptions {
  search?: string
  searchFields?: string[]
  filter?: Record<string, unknown>
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
  includeArchived?: boolean
}

export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

const STORAGE_PREFIX = 'smart-ca-db:'
const META_KEY = 'smart-ca-db:__meta__'
const DB_VERSION = 3

type AnyRecord = BaseRecord & Record<string, unknown>

function nowISO() {
  return new Date().toISOString()
}

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

function matchesSearch(record: AnyRecord, query: string, fields?: string[]): boolean {
  const q = query.toLowerCase()
  const keys = fields?.length ? fields : Object.keys(record)
  return keys.some((key) => {
    const val = record[key]
    if (val == null) return false
    if (Array.isArray(val)) return val.some((v) => String(v).toLowerCase().includes(q))
    return String(val).toLowerCase().includes(q)
  })
}

function matchesFilter(record: AnyRecord, filter: Record<string, unknown>): boolean {
  return Object.entries(filter).every(([key, expected]) => {
    if (expected === undefined || expected === null || expected === '') return true
    const actual = record[key]
    if (Array.isArray(expected)) return expected.includes(actual)
    return actual === expected
  })
}

class CollectionStore<T extends { id: string }> {
  private name: string
  private getAll: () => AnyRecord[]
  private setAll: (rows: AnyRecord[]) => void

  constructor(name: string, getAll: () => AnyRecord[], setAll: (rows: AnyRecord[]) => void) {
    this.name = name
    this.getAll = getAll
    this.setAll = setAll
  }

  private read(): AnyRecord[] {
    return this.getAll()
  }

  private write(rows: AnyRecord[]) {
    this.setAll(rows)
  }

  findMany(options: QueryOptions = {}): PaginatedResult<T> {
    let rows = this.read()

    if (!options.includeArchived) {
      rows = rows.filter((r) => !r.archived)
    }

    if (options.filter) {
      rows = rows.filter((r) => matchesFilter(r, options.filter!))
    }

    if (options.search?.trim()) {
      rows = rows.filter((r) => matchesSearch(r, options.search!, options.searchFields))
    }

    if (options.sortBy) {
      const key = options.sortBy
      const dir = options.sortOrder === 'desc' ? -1 : 1
      rows = [...rows].sort((a, b) => {
        const av = a[key]
        const bv = b[key]
        if (av == null) return 1
        if (bv == null) return -1
        if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
        return String(av).localeCompare(String(bv)) * dir
      })
    }

    const total = rows.length
    const page = options.page || 1
    const pageSize = options.pageSize || 50
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const start = (page - 1) * pageSize
    const data = rows.slice(start, start + pageSize).map(deepClone) as T[]

    return { data, total, page, pageSize, totalPages }
  }

  find(options: QueryOptions = {}): T[] {
    return this.findMany({ ...options, page: 1, pageSize: 100000 }).data
  }

  findById(id: RecordId): T | null {
    const row = this.read().find((r) => r.id === id)
    return row ? (deepClone(row) as T) : null
  }

  count(options: QueryOptions = {}): number {
    return this.findMany({ ...options, page: 1, pageSize: 1 }).total
  }

  insert(payload: Partial<T> & { id?: string }): T {
    const rows = this.read()
    const id = payload.id || `${this.name.slice(0, 3).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`
    if (rows.some((r) => r.id === id)) {
      throw new Error(`Record with id ${id} already exists in ${this.name}`)
    }
    const record = {
      ...deepClone(payload),
      id,
      archived: false,
      createdAt: nowISO(),
      updatedAt: nowISO(),
    } as AnyRecord
    rows.push(record)
    this.write(rows)
    return deepClone(record) as T
  }

  update(id: RecordId, patch: Partial<T>): T {
    const rows = this.read()
    const index = rows.findIndex((r) => r.id === id)
    if (index === -1) throw new Error(`${this.name} record not found: ${id}`)
    const updated = {
      ...rows[index],
      ...deepClone(patch),
      id,
      updatedAt: nowISO(),
    } as AnyRecord
    rows[index] = updated
    this.write(rows)
    return deepClone(updated) as T
  }

  delete(id: RecordId): boolean {
    const rows = this.read()
    const index = rows.findIndex((r) => r.id === id)
    if (index === -1) return false
    rows.splice(index, 1)
    this.write(rows)
    return true
  }

  archive(id: RecordId): T {
    return this.update(id, { archived: true } as unknown as Partial<T>)
  }

  restore(id: RecordId): T {
    return this.update(id, { archived: false } as unknown as Partial<T>)
  }

  duplicate(id: RecordId, overrides: Partial<T> = {}): T {
    const source = this.findById(id)
    if (!source) throw new Error(`${this.name} record not found: ${id}`)
    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = source as AnyRecord
    return this.insert({ ...rest, ...overrides } as Partial<T> & { id?: string })
  }

  replaceAll(rows: T[]) {
    this.write(rows.map((r) => deepClone(r) as AnyRecord))
  }

  getAllRaw(): T[] {
    return deepClone(this.read()) as T[]
  }
}

class MockDatabaseEngine {
  private collections = new Map<string, AnyRecord[]>()
  private listeners = new Set<() => void>()

  private storageKey(name: string) {
    return `${STORAGE_PREFIX}${name}`
  }

  private loadFromStorage(name: string): AnyRecord[] | null {
    try {
      const raw = localStorage.getItem(this.storageKey(name))
      if (!raw) return null
      return JSON.parse(raw) as AnyRecord[]
    } catch {
      return null
    }
  }

  private saveToStorage(name: string, rows: AnyRecord[]) {
    localStorage.setItem(this.storageKey(name), JSON.stringify(rows))
    this.notify()
  }

  private notify() {
    this.listeners.forEach((fn) => fn())
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  isSeeded(): boolean {
    try {
      const meta = localStorage.getItem(META_KEY)
      if (!meta) return false
      const parsed = JSON.parse(meta) as { version: number }
      return parsed.version === DB_VERSION
    } catch {
      return false
    }
  }

  seed(initial: Record<string, BaseRecord[]>, force = false) {
    if (!force && this.isSeeded()) {
      Object.keys(initial).forEach((name) => {
        const stored = this.loadFromStorage(name)
        this.collections.set(name, (stored ?? deepClone(initial[name])) as AnyRecord[])
        if (!stored) this.saveToStorage(name, this.collections.get(name)!)
      })
      return
    }

    Object.entries(initial).forEach(([name, rows]) => {
      const cloned = deepClone(rows) as AnyRecord[]
      this.collections.set(name, cloned)
      this.saveToStorage(name, cloned)
    })
    localStorage.setItem(META_KEY, JSON.stringify({ version: DB_VERSION, seededAt: nowISO() }))
  }

  ensureCollection(name: string, fallback: BaseRecord[] = []) {
    if (!this.collections.has(name)) {
      const stored = this.loadFromStorage(name)
      this.collections.set(name, (stored ?? deepClone(fallback)) as AnyRecord[])
      if (!stored) this.saveToStorage(name, this.collections.get(name)!)
    }
  }

  collection<T extends { id: string } = AnyRecord>(name: string): CollectionStore<T> {
    this.ensureCollection(name)
    return new CollectionStore<T>(
      name,
      () => this.collections.get(name) || [],
      (rows) => {
        this.collections.set(name, rows)
        this.saveToStorage(name, rows)
      }
    )
  }

  transaction(fn: (db: MockDatabaseEngine) => void) {
    fn(this)
  }

  reset(initial: Record<string, BaseRecord[]>) {
    Object.keys(initial).forEach((name) => {
      localStorage.removeItem(this.storageKey(name))
    })
    localStorage.removeItem(META_KEY)
    this.collections.clear()
    this.seed(initial, true)
  }

  exportAll(): Record<string, BaseRecord[]> {
    const out: Record<string, BaseRecord[]> = {}
    this.collections.forEach((rows, name) => {
      out[name] = deepClone(rows)
    })
    return out
  }
}

export const MockDatabase = new MockDatabaseEngine()
export type { CollectionStore }
