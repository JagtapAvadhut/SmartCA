import { COLLECTION } from '@/db'

type Snapshot = Record<string, string | null>

/** Snapshot LocalStorage collections for rollback on multi-entity failures. */
export function beginTransaction(collections: string[] = Object.values(COLLECTION)): Snapshot {
  const snap: Snapshot = {}
  collections.forEach((name) => {
    const key = `smart-ca-db:${name}`
    snap[key] = localStorage.getItem(key)
  })
  return snap
}

export function rollbackTransaction(snap: Snapshot) {
  Object.entries(snap).forEach(([key, value]) => {
    if (value == null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  })
}

/** Run work; on throw restore prior LocalStorage collection state. */
export function withTransaction<T>(work: () => T, collections?: string[]): T {
  const snap = beginTransaction(collections)
  try {
    return work()
  } catch (e) {
    rollbackTransaction(snap)
    throw e
  }
}

export async function withTransactionAsync<T>(work: () => Promise<T>, collections?: string[]): Promise<T> {
  const snap = beginTransaction(collections)
  try {
    return await work()
  } catch (e) {
    rollbackTransaction(snap)
    throw e
  }
}
