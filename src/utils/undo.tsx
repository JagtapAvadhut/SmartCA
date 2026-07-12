import toast from 'react-hot-toast'
import { getCollection, type CollectionKey } from '@/db'

const UNDO_KEY = 'smart-ca-undo-stack'

export interface UndoSnapshot {
  id: string
  collection: CollectionKey
  record: Record<string, unknown>
  label: string
  expiresAt: number
}

function readStack(): UndoSnapshot[] {
  try {
    return JSON.parse(localStorage.getItem(UNDO_KEY) || '[]') as UndoSnapshot[]
  } catch {
    return []
  }
}

function writeStack(stack: UndoSnapshot[]) {
  localStorage.setItem(UNDO_KEY, JSON.stringify(stack.slice(0, 10)))
}

export function pushUndo(snapshot: Omit<UndoSnapshot, 'id' | 'expiresAt'>) {
  const item: UndoSnapshot = {
    ...snapshot,
    id: `undo-${Date.now()}`,
    expiresAt: Date.now() + 12000,
  }
  const stack = readStack()
  stack.unshift(item)
  writeStack(stack)
  return item
}

export function restoreUndo(id: string): boolean {
  const stack = readStack()
  const item = stack.find((s) => s.id === id)
  if (!item) return false
  writeStack(stack.filter((s) => s.id !== id))
  const col = getCollection(item.collection)
  const existing = col.findById(String(item.record.id))
  if (existing) {
    col.update(String(item.record.id), { ...item.record, archived: false })
  } else {
    col.insert({ ...item.record })
  }
  return true
}

export function deleteWithUndo(options: {
  collection: CollectionKey
  record: Record<string, unknown> & { id: string }
  label: string
  performDelete: () => void
  onRestored: () => void
}) {
  const snapshot = pushUndo({
    collection: options.collection,
    record: options.record,
    label: options.label,
  })
  options.performDelete()

  toast.custom(
    (t) => (
      <div className="flex items-center gap-3 rounded-xl bg-white dark:bg-gray-800 shadow-lg border border-gray-100 dark:border-gray-700 px-4 py-3 text-sm">
        <span className="text-gray-800 dark:text-gray-100">{options.label} removed</span>
        <button
          type="button"
          className="font-semibold text-primary-600 hover:text-primary-700"
          onClick={() => {
            if (restoreUndo(snapshot.id)) {
              options.onRestored()
              toast.dismiss(t.id)
              toast.success('Restored')
            }
          }}
        >
          Undo
        </button>
        <button
          type="button"
          className="text-gray-400 hover:text-gray-600"
          onClick={() => toast.dismiss(t.id)}
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    ),
    { duration: 10000, id: snapshot.id }
  )
}
