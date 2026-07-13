import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { Plus, Pin } from 'lucide-react'
import toast from 'react-hot-toast'
import { z } from 'zod'
import { NoteService, type NoteRecord } from '@/services/noteService'
import { COLLECTION } from '@/db'
import {
  PageHeader, DataTable, Button, Can, EntityFormModal, ConfirmDialog, RowActions, type FormField,
} from '@/components/common'
import { formatRelativeTime, deleteWithUndo, invalidateAfterMutation } from '@/utils'

const noteSchema = z.object({
  title: z.string().min(2, 'Title is required').max(120),
  body: z.string().min(1, 'Note body is required').max(5000),
  pinned: z.enum(['yes', 'no']).optional(),
})

type NoteForm = z.infer<typeof noteSchema>

const fields: FormField[] = [
  { name: 'title', label: 'Title', required: true, colSpan: 2 },
  { name: 'body', label: 'Note', type: 'textarea', required: true, colSpan: 2 },
  { name: 'pinned', label: 'Pin to top', type: 'select', options: [
    { label: 'No', value: 'no' }, { label: 'Yes', value: 'yes' },
  ]},
]

export default function NotesPage() {
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<NoteRecord | null>(null)
  const [deleting, setDeleting] = useState<NoteRecord | null>(null)
  const [saving, setSaving] = useState(false)
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['notes'],
    queryFn: () => NoteService.getAll({ pageSize: 500, sortBy: 'updatedAt', sortOrder: 'desc' }),
  })

  const invalidate = () => invalidateAfterMutation(queryClient, ['notes'])

  const handleSubmit = async (form: NoteForm) => {
    setSaving(true)
    try {
      const payload = { title: form.title, body: form.body, pinned: form.pinned === 'yes' }
      if (editing) {
        await NoteService.update(editing.id, payload)
        toast.success('Note updated')
      } else {
        await NoteService.create(payload)
        toast.success('Note created')
      }
      setFormOpen(false)
      invalidate()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save note')
    } finally {
      setSaving(false)
    }
  }

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deleting) return
      const record = { ...deleting } as unknown as Record<string, unknown> & { id: string }
      deleteWithUndo({
        collection: COLLECTION.notes,
        record,
        label: deleting.title,
        performDelete: () => { NoteService.delete(deleting.id) },
        onRestored: invalidate,
      })
      setDeleting(null)
      invalidate()
    },
  })

  const columns: ColumnDef<NoteRecord, unknown>[] = useMemo(() => [
    {
      accessorKey: 'title',
      header: 'Note',
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
            {row.original.pinned && <Pin className="h-3.5 w-3.5 text-amber-500" />}
            {row.original.title}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-md">{row.original.body}</p>
        </div>
      ),
    },
    {
      accessorKey: 'updatedAt',
      header: 'Updated',
      cell: ({ getValue }) => formatRelativeTime(String(getValue() || '')),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <RowActions
          onEdit={() => { setEditing(row.original); setFormOpen(true) }}
          onDelete={() => setDeleting(row.original)}
          onDuplicate={async () => {
            await NoteService.duplicate(row.original.id, { title: `${row.original.title} (Copy)` })
            toast.success('Note duplicated')
            invalidate()
          }}
        />
      ),
    },
  ], [])

  return (
    <div>
      <PageHeader
        title="Notes"
        description="Practice notes persisted locally for your demo workspace"
        actions={
          <Can permission="dashboard.view">
            <Button onClick={() => { setEditing(null); setFormOpen(true) }}>
              <Plus className="h-4 w-4" /> New Note
            </Button>
          </Can>
        }
      />
      <DataTable data={data?.data || []} columns={columns} searchPlaceholder="Search notes..." exportFilename="notes" loading={isLoading} />
      <EntityFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
        title={editing ? 'Edit Note' : 'New Note'}
        fields={fields}
        schema={noteSchema}
        defaultValues={editing ? { title: editing.title, body: editing.body, pinned: editing.pinned ? 'yes' : 'no' } : { pinned: 'no' }}
        loading={saving}
      />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleteMutation.mutate()}
        title="Delete Note"
        message={`Delete "${deleting?.title}"? You can undo shortly.`}
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
