import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArchiveRestore, Trash2, RotateCcw, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { ArchiveService, type ArchiveEntity, type ArchivedItem } from '@/services/archiveService'
import { PageHeader, Card, Button, Badge, ConfirmDialog, EmptyState } from '@/components/common'
import { formatRelativeTime, invalidateAfterMutation, cn } from '@/utils'

const TABS: Array<{ id: ArchiveEntity | 'all'; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'clients', label: 'Clients' },
  { id: 'companies', label: 'Companies' },
  { id: 'employees', label: 'Employees' },
  { id: 'invoices', label: 'Invoices' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'documents', label: 'Documents' },
  { id: 'payments', label: 'Payments' },
  { id: 'notes', label: 'Notes' },
]

export default function RecycleBinPage() {
  const [tab, setTab] = useState<ArchiveEntity | 'all'>('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
  const [deletingOne, setDeletingOne] = useState<ArchivedItem | null>(null)
  const queryClient = useQueryClient()

  const { data = [], isLoading } = useQuery({
    queryKey: ['recycle-bin', tab],
    queryFn: () => ArchiveService.list(tab),
  })

  const invalidate = () => {
    invalidateAfterMutation(queryClient, ['recycle-bin'])
    void queryClient.invalidateQueries({ queryKey: ['recycle-bin'] })
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return data
    return data.filter((i) => i.title.toLowerCase().includes(q) || i.subtitle.toLowerCase().includes(q) || i.entity.includes(q))
  }, [data, search])

  const keyOf = (i: ArchivedItem) => `${i.entity}:${i.id}`

  const toggle = (item: ArchivedItem) => {
    const k = keyOf(item)
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map(keyOf)))
  }

  const selectedItems = filtered.filter((i) => selected.has(keyOf(i)))

  const restoreOne = useMutation({
    mutationFn: (item: ArchivedItem) => ArchiveService.restore(item.entity, item.id),
    onSuccess: (_d, item) => {
      toast.success(`Restored ${item.title}`)
      setSelected((s) => { const n = new Set(s); n.delete(keyOf(item)); return n })
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteOne = useMutation({
    mutationFn: (item: ArchivedItem) => ArchiveService.permanentDelete(item.entity, item.id),
    onSuccess: () => {
      toast.success('Permanently deleted')
      setDeletingOne(null)
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const bulkRestore = useMutation({
    mutationFn: () => ArchiveService.bulkRestore(selectedItems.map((i) => ({ entity: i.entity, id: i.id }))),
    onSuccess: (r) => {
      toast.success(`Restored ${r.count} item(s)`)
      setSelected(new Set())
      invalidate()
    },
  })

  const bulkDelete = useMutation({
    mutationFn: () => ArchiveService.bulkDelete(selectedItems.map((i) => ({ entity: i.entity, id: i.id }))),
    onSuccess: (r) => {
      toast.success(`Deleted ${r.count} item(s)`)
      setSelected(new Set())
      setConfirmBulkDelete(false)
      invalidate()
    },
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recycle Bin"
        description="Restore archived records or permanently delete them. All actions persist on the Go API."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={!selectedItems.length} onClick={() => bulkRestore.mutate()} loading={bulkRestore.isPending}>
              <RotateCcw className="h-4 w-4" /> Bulk Restore
            </Button>
            <Button variant="danger" disabled={!selectedItems.length} onClick={() => setConfirmBulkDelete(true)}>
              <Trash2 className="h-4 w-4" /> Bulk Delete
            </Button>
          </div>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search archived records..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100"
          />
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => { setTab(t.id); setSelected(new Set()) }}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors',
              tab === t.id
                ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border-primary-200 dark:border-primary-800'
                : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Card padding={false}>
        {isLoading ? (
          <p className="p-8 text-sm text-gray-500 dark:text-gray-400">Loading archived items...</p>
        ) : filtered.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={<ArchiveRestore className="h-8 w-8 text-gray-400" />}
              title="Recycle Bin is empty"
              description="Archived clients, companies, employees, invoices, tasks, and more will appear here."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800/80 backdrop-blur border-b border-gray-100 dark:border-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={toggleAll} aria-label="Select all" />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Record</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Archived</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {filtered.map((item) => (
                  <tr key={keyOf(item)} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selected.has(keyOf(item))} onChange={() => toggle(item)} aria-label={`Select ${item.title}`} />
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.title}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-md">{item.subtitle}</p>
                    </td>
                    <td className="px-4 py-3"><Badge>{item.entity}</Badge></td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{item.archivedAt ? formatRelativeTime(item.archivedAt) : '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="outline" onClick={() => restoreOne.mutate(item)}>
                          <RotateCcw className="h-3.5 w-3.5" /> Restore
                        </Button>
                        <Button size="sm" variant="ghost" className="text-red-500" onClick={() => setDeletingOne(item)}>
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={!!deletingOne}
        onClose={() => setDeletingOne(null)}
        onConfirm={() => deletingOne && deleteOne.mutate(deletingOne)}
        title="Permanent Delete"
        message={`Permanently delete "${deletingOne?.title}"? This cannot be undone.`}
        confirmLabel="Delete forever"
        loading={deleteOne.isPending}
      />
      <ConfirmDialog
        open={confirmBulkDelete}
        onClose={() => setConfirmBulkDelete(false)}
        onConfirm={() => bulkDelete.mutate()}
        title="Bulk Permanent Delete"
        message={`Permanently delete ${selectedItems.length} archived item(s)?`}
        confirmLabel="Delete forever"
        loading={bulkDelete.isPending}
      />
    </div>
  )
}
