import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'
import { type ColumnDef } from '@tanstack/react-table'
import { Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { InvoiceService, ClientService } from '@/services'
import { COLLECTION } from '@/db'
import {
  PageHeader, DataTable, Badge, Button, Can, EntityFormModal, ConfirmDialog, RowActions, type FormField,
} from '@/components/common'
import { formatCurrency, formatDate, deleteWithUndo, invalidateAfterMutation } from '@/utils'
import { invoiceSchema, type InvoiceForm } from '@/schemas/entities'
import type { Invoice } from '@/types'
import { invoiceRepository } from '@/repositories'

export default function InvoicesPage() {
  const [params] = useSearchParams()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Invoice | null>(null)
  const [deleting, setDeleting] = useState<Invoice | null>(null)
  const [saving, setSaving] = useState(false)
  const [prefillClientId, setPrefillClientId] = useState('')
  const [initialSearch, setInitialSearch] = useState('')
  const queryClient = useQueryClient()

  useEffect(() => {
    const clientId = params.get('clientId') || ''
    const create = params.get('create') === '1'
    const q = params.get('q') || ''
    if (clientId) setPrefillClientId(clientId)
    if (create) {
      setEditing(null)
      setFormOpen(true)
    }
    if (q) setInitialSearch(q)
  }, [params])

  const { data, isLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => InvoiceService.getAll({ pageSize: 500 }),
  })
  const { data: clients } = useQuery({
    queryKey: ['clients-options'],
    queryFn: () => ClientService.getAll({ pageSize: 500 }),
  })

  const invalidate = () => invalidateAfterMutation(queryClient, ['invoices', 'invoices-options', 'clients'])

  const clientOptions = (clients?.data || []).map((c) => ({ label: c.name, value: c.id }))

  const fields: FormField[] = [
    { name: 'clientId', label: 'Client', type: 'select', options: clientOptions, required: true, syncLabelTo: 'clientName' },
    { name: 'clientName', label: 'Client Name', hidden: true },
    { name: 'subtotal', label: 'Amount (₹)', type: 'number', required: true },
    { name: 'status', label: 'Status', type: 'select', options: [
      { label: 'Draft', value: 'draft' }, { label: 'Sent', value: 'sent' },
      { label: 'Partially Paid', value: 'partially_paid' },
      { label: 'Paid', value: 'paid' }, { label: 'Overdue', value: 'overdue' }, { label: 'Cancelled', value: 'cancelled' },
    ]},
    { name: 'issueDate', label: 'Issue Date', type: 'date', required: true },
    { name: 'dueDate', label: 'Due Date', type: 'date', required: true },
    { name: 'notes', label: 'Notes', type: 'textarea', colSpan: 2 },
  ]

  const handleSubmit = async (form: InvoiceForm) => {
    setSaving(true)
    try {
      const client = clients?.data.find((c) => c.id === form.clientId)
      const payload = { ...form, clientName: client?.name || form.clientName }
      if (editing) {
        const tax = Math.round(form.subtotal * 0.18)
        await InvoiceService.update(editing.id, {
          ...payload,
          cgst: tax / 2,
          sgst: tax / 2,
          total: form.subtotal + tax,
        })
        toast.success('Invoice updated')
      } else {
        await InvoiceService.create(payload)
        toast.success('Invoice created')
      }
      setFormOpen(false)
      invalidate()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save invoice')
    } finally {
      setSaving(false)
    }
  }

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deleting) return
      const record = { ...deleting } as unknown as Record<string, unknown> & { id: string }
      deleteWithUndo({
        collection: COLLECTION.invoices,
        record,
        label: deleting.invoiceNumber,
        performDelete: () => { InvoiceService.delete(deleting.id) },
        onRestored: invalidate,
      })
      setDeleting(null)
      invalidate()
    },
  })

  const columns: ColumnDef<Invoice, unknown>[] = useMemo(() => [
    { accessorKey: 'invoiceNumber', header: 'Invoice #' },
    { accessorKey: 'clientName', header: 'Client' },
    { accessorKey: 'issueDate', header: 'Issue Date', cell: ({ getValue }) => formatDate(getValue() as string) },
    { accessorKey: 'dueDate', header: 'Due Date', cell: ({ getValue }) => formatDate(getValue() as string) },
    { accessorKey: 'total', header: 'Amount', cell: ({ getValue }) => formatCurrency(getValue() as number) },
    { accessorKey: 'paidAmount', header: 'Paid', cell: ({ getValue }) => formatCurrency(getValue() as number) },
    { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <Badge status={getValue() as string} /> },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <RowActions
          onEdit={() => { setEditing(row.original); setFormOpen(true) }}
          onDelete={() => setDeleting(row.original)}
          onDuplicate={async () => {
            await InvoiceService.duplicate(row.original.id)
            toast.success('Invoice duplicated')
            invalidate()
          }}
          editPermission="invoices.edit"
          deletePermission="invoices.delete"
        />
      ),
    },
  ], [])

  const defaults = editing
    ? {
        clientId: editing.clientId,
        clientName: editing.clientName,
        subtotal: editing.subtotal,
        status: editing.status as InvoiceForm['status'],
        issueDate: editing.issueDate,
        dueDate: editing.dueDate,
        notes: editing.notes,
      }
    : {
        status: 'draft' as const,
        issueDate: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
        subtotal: 10000,
        clientId: prefillClientId,
        clientName: clients?.data.find((c) => c.id === prefillClientId)?.name || '',
      }

  return (
    <div>
      <PageHeader
        title="Invoices"
        description={`${data?.total || 0} invoices`}
        actions={
          <Can permission="invoices.create">
            <Button onClick={() => { setEditing(null); setFormOpen(true) }}>
              <Plus className="h-4 w-4" /> Create Invoice
            </Button>
          </Can>
        }
      />
      <DataTable
        key={`invoices-${initialSearch}`}
        data={data?.data || []}
        columns={columns}
        searchPlaceholder="Search invoices..."
        exportFilename="invoices"
        loading={isLoading}
        initialSearch={initialSearch}
      />

      <EntityFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={async (form) => {
          const client = clients?.data.find((c) => c.id === form.clientId)
          await handleSubmit({ ...form, clientName: client?.name || form.clientName })
        }}
        title={editing ? 'Edit Invoice' : 'Create Invoice'}
        fields={fields}
        schema={invoiceSchema}
        defaultValues={defaults}
        loading={saving}
        draftKey={editing ? `invoice-${editing.id}` : 'invoice-create'}
      />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleteMutation.mutate()}
        onArchive={() => {
          if (!deleting) return
          void invoiceRepository.archive(deleting.id).then(() => {
            toast.success(`${deleting.invoiceNumber} archived`)
            setDeleting(null)
            invalidate()
          })
        }}
        title="Remove Invoice"
        message={`Delete ${deleting?.invoiceNumber}? Archive keeps it in Recycle Bin.`}
        confirmLabel="Delete"
        archiveLabel="Archive instead"
        preferArchive
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
