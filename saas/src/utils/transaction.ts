/** Transactions are owned by the Go backend — these are no-ops for API-era compatibility. */

type Snapshot = Record<string, string | null>

export function beginTransaction(_collections?: string[]): Snapshot {
  return {}
}

export function rollbackTransaction(_snap: Snapshot) {
  /* no-op */
}

export function withTransaction<T>(work: () => T, _collections?: string[]): T {
  return work()
}

export async function withTransactionAsync<T>(
  work: () => Promise<T>,
  _collections?: string[],
): Promise<T> {
  return work()
}
