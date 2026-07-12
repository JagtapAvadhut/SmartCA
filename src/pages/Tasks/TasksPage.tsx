import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { TaskService, ClientService } from '@/services'
import { COLLECTION } from '@/db'
import {
  PageHeader, DataTable, Badge, Button, Can, EntityFormModal, ConfirmDialog, RowActions, type FormField,
} from '@/components/common'
import { formatDate, deleteWithUndo, invalidateAfterMutation } from '@/utils'
import { taskSchema, type TaskForm } from '@/schemas/entities'
import type { Task } from '@/types'

export default function TasksPage() {
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Task | null>(null)
  const [deleting, setDeleting] = useState<Task | null>(null)
  const [saving, setSaving] = useState(false)
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => TaskService.getAll({ pageSize: 500 }),
  })
  const { data: clients } = useQuery({
    queryKey: ['clients-options'],
    queryFn: () => ClientService.getAll({ pageSize: 500 }),
  })

  const invalidate = () => invalidateAfterMutation(queryClient, ['tasks'])
  const clientOptions = (clients?.data || []).map((c) => ({ label: c.name, value: c.id }))

  const fields: FormField[] = [
    { name: 'title', label: 'Title', required: true, colSpan: 2 },
    { name: 'clientId', label: 'Client', type: 'select', options: clientOptions, required: true, syncLabelTo: 'clientName' },
    { name: 'clientName', label: 'Client Name', hidden: true },
    { name: 'dueDate', label: 'Due Date', type: 'date', required: true },
    { name: 'priority', label: 'Priority', type: 'select', options: [
      { label: 'Low', value: 'low' }, { label: 'Medium', value: 'medium' },
      { label: 'High', value: 'high' }, { label: 'Urgent', value: 'urgent' },
    ]},
    { name: 'status', label: 'Status', type: 'select', options: [
      { label: 'To Do', value: 'todo' }, { label: 'In Progress', value: 'in_progress' },
      { label: 'Review', value: 'review' }, { label: 'Completed', value: 'completed' },
    ]},
    { name: 'category', label: 'Category', type: 'select', options: [
      { label: 'Compliance', value: 'compliance' }, { label: 'Billing', value: 'billing' },
      { label: 'Documentation', value: 'documentation' }, { label: 'Follow Up', value: 'follow_up' },
      { label: 'Meeting', value: 'meeting' },
    ]},
    { name: 'assignedToName', label: 'Assigned To' },
    { name: 'description', label: 'Description', type: 'textarea', colSpan: 2 },
  ]

  const handleSubmit = async (form: TaskForm) => {
    setSaving(true)
    try {
      const client = clients?.data.find((c) => c.id === form.clientId)
      const payload = { ...form, clientName: client?.name || form.clientName }
      if (editing) {
        await TaskService.update(editing.id, {
          ...payload,
          completedAt: form.status === 'completed' ? new Date().toISOString() : null,
        })
        toast.success('Task updated')
      } else {
        await TaskService.create(payload)
        toast.success('Task created')
      }
      setFormOpen(false)
      invalidate()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save task')
    } finally {
      setSaving(false)
    }
  }

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deleting) return
      const record = { ...deleting } as unknown as Record<string, unknown> & { id: string }
      deleteWithUndo({
        collection: COLLECTION.tasks,
        record,
        label: deleting.title,
        performDelete: () => { TaskService.delete(deleting.id) },
        onRestored: invalidate,
      })
      setDeleting(null)
      invalidate()
    },
  })

  const columns: ColumnDef<Task, unknown>[] = useMemo(() => [
    { accessorKey: 'title', header: 'Task' },
    { accessorKey: 'clientName', header: 'Client' },
    { accessorKey: 'assignedToName', header: 'Assigned To' },
    { accessorKey: 'category', header: 'Category', cell: ({ getValue }) => String(getValue()).replace(/_/g, ' ') },
    { accessorKey: 'dueDate', header: 'Due Date', cell: ({ getValue }) => formatDate(getValue() as string) },
    { accessorKey: 'priority', header: 'Priority', cell: ({ getValue }) => <Badge priority={getValue() as string} variant="priority" /> },
    { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <Badge status={getValue() as string} /> },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <RowActions
          onEdit={() => { setEditing(row.original); setFormOpen(true) }}
          onDelete={() => setDeleting(row.original)}
          onDuplicate={async () => {
            await TaskService.duplicate(row.original.id, { title: `${row.original.title} (Copy)` })
            toast.success('Task duplicated')
            invalidate()
          }}
          editPermission="tasks.edit"
          deletePermission="tasks.delete"
        />
      ),
    },
  ], [])

  const defaults = editing
    ? {
        title: editing.title,
        description: editing.description,
        clientId: editing.clientId,
        clientName: editing.clientName,
        assignedTo: editing.assignedTo,
        assignedToName: editing.assignedToName,
        dueDate: editing.dueDate,
        priority: editing.priority as TaskForm['priority'],
        status: editing.status as TaskForm['status'],
        category: editing.category as TaskForm['category'],
      }
    : {
        priority: 'medium' as const,
        status: 'todo' as const,
        category: 'compliance' as const,
        dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
        clientName: '',
      }

  return (
    <div>
      <PageHeader title="Tasks" description={`${data?.total || 0} tasks`} actions={
        <Can permission="tasks.create">
          <Button onClick={() => { setEditing(null); setFormOpen(true) }}>
            <Plus className="h-4 w-4" /> Create Task
          </Button>
        </Can>
      } />
      <DataTable data={data?.data || []} columns={columns} searchPlaceholder="Search tasks..." exportFilename="tasks" loading={isLoading} />

      <EntityFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={async (form) => {
          const client = clients?.data.find((c) => c.id === form.clientId)
          await handleSubmit({ ...form, clientName: client?.name || form.clientName })
        }}
        title={editing ? 'Edit Task' : 'Create Task'}
        fields={fields}
        schema={taskSchema}
        defaultValues={defaults}
        loading={saving}
      />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleteMutation.mutate()}
        title="Delete Task"
        message={`Delete "${deleting?.title}"? You can undo shortly.`}
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
