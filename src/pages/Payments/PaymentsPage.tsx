import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'
import { type ColumnDef } from '@tanstack/react-table'
import { Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { PaymentService, ClientService, InvoiceService } from '@/services'
import { COLLECTION } from '@/db'
import {
  PageHeader, DataTable, Badge, Button, Can, EntityFormModal, ConfirmDialog, RowActions, type FormField,
} from '@/components/common'
import { formatCurrency, formatDate, deleteWithUndo, invalidateAfterMutation } from '@/utils'
import { paymentSchema, type PaymentForm } from '@/schemas/entities'
import type { Payment } from '@/types'

export default function PaymentsPage() {
  const [params] = useSearchParams()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Payment | null>(null)
  const [deleting, setDeleting] = useState<Payment | null>(null)
  const [saving, setSaving] = useState(false)
  const [prefillClientId, setPrefillClientId] = useState('')
  const queryClient = useQueryClient()

  useEffect(() => {
    const clientId = params.get('clientId') || ''
    if (clientId) setPrefillClientId(clientId)
    if (params.get('create') === '1') {
      setEditing(null)
      setFormOpen(true)
    }
  }, [params])

  const { data, isLoading } = useQuery({ queryKey: ['payments'], queryFn: () => PaymentService.getAll({ pageSize: 500 }) })
  const { data: clients } = useQuery({ queryKey: ['clients-options'], queryFn: () => ClientService.getAll({ pageSize: 500 }) })
  const { data: invoices } = useQuery({ queryKey: ['invoices-options'], queryFn: () => InvoiceService.getAll({ pageSize: 500 }) })

  const invalidate = () => invalidateAfterMutation(queryClient, ['payments', 'invoices', 'invoices-options', 'clients'])

  const fields: FormField[] = [
    { name: 'clientId', label: 'Client', type: 'select', options: (clients?.data || []).map((c) => ({ label: c.name, value: c.id })), required: true, syncLabelTo: 'clientName' },
    { name: 'clientName', label: 'Client Name', hidden: true },
    { name: 'invoiceId', label: 'Invoice', type: 'select', options: (invoices?.data || []).map((i) => ({ label: i.invoiceNumber, value: i.id })), required: true, syncLabelTo: 'invoiceNumber' },
    { name: 'invoiceNumber', label: 'Invoice Number', hidden: true },
    { name: 'amount', label: 'Amount (₹)', type: 'number', required: true },
    { name: 'paymentDate', label: 'Payment Date', type: 'date', required: true },
    { name: 'method', label: 'Method', type: 'select', options: [
      { label: 'Bank Transfer', value: 'bank_transfer' }, { label: 'UPI', value: 'upi' },
      { label: 'NEFT', value: 'neft' }, { label: 'RTGS', value: 'rtgs' },
      { label: 'Cheque', value: 'cheque' }, { label: 'Cash', value: 'cash' },
    ]},
    { name: 'status', label: 'Status', type: 'select', options: [
      { label: 'Completed', value: 'completed' }, { label: 'Pending', value: 'pending' }, { label: 'Failed', value: 'failed' },
    ]},
    { name: 'reference', label: 'Reference' },
    { name: 'notes', label: 'Notes', type: 'textarea', colSpan: 2 },
  ]

  const handleSubmit = async (form: PaymentForm) => {
    setSaving(true)
    try {
      const client = clients?.data.find((c) => c.id === form.clientId)
      const invoice = invoices?.data.find((i) => i.id === form.invoiceId)
      const payload = {
        ...form,
        clientName: client?.name || form.clientName,
        invoiceNumber: invoice?.invoiceNumber || form.invoiceNumber,
      }
      if (editing) {
        await PaymentService.update(editing.id, payload)
        toast.success('Payment updated')
      } else {
        await PaymentService.create(payload)
        toast.success('Payment recorded')
      }
      setFormOpen(false)
      invalidate()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save payment')
    } finally {
      setSaving(false)
    }
  }

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deleting) return
      const record = { ...deleting } as unknown as Record<string, unknown> & { id: string }
      deleteWithUndo({
        collection: COLLECTION.payments,
        record,
        label: deleting.reference,
        performDelete: () => { PaymentService.delete(deleting.id) },
        onRestored: invalidate,
      })
      setDeleting(null)
      invalidate()
    },
  })

  const columns: ColumnDef<Payment, unknown>[] = useMemo(() => [
    { accessorKey: 'reference', header: 'Reference' },
    { accessorKey: 'clientName', header: 'Client' },
    { accessorKey: 'invoiceNumber', header: 'Invoice' },
    { accessorKey: 'amount', header: 'Amount', cell: ({ getValue }) => formatCurrency(getValue() as number) },
    { accessorKey: 'paymentDate', header: 'Date', cell: ({ getValue }) => formatDate(getValue() as string) },
    { accessorKey: 'method', header: 'Method', cell: ({ getValue }) => String(getValue()).replace(/_/g, ' ').toUpperCase() },
    { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <Badge status={getValue() as string} /> },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <RowActions
          onEdit={() => { setEditing(row.original); setFormOpen(true) }}
          onDelete={() => setDeleting(row.original)}
          editPermission="payments.create"
          deletePermission="payments.create"
        />
      ),
    },
  ], [])

  const defaults = editing
    ? {
        clientId: editing.clientId,
        clientName: editing.clientName,
        invoiceId: editing.invoiceId,
        invoiceNumber: editing.invoiceNumber,
        amount: editing.amount,
        paymentDate: editing.paymentDate,
        method: editing.method as PaymentForm['method'],
        status: editing.status as PaymentForm['status'],
        reference: editing.reference,
        notes: editing.notes,
      }
    : {
        paymentDate: new Date().toISOString().split('T')[0],
        method: 'bank_transfer' as const,
        status: 'completed' as const,
        amount: 10000,
        clientId: prefillClientId,
        clientName: clients?.data.find((c) => c.id === prefillClientId)?.name || '',
        invoiceNumber: '',
      }

  return (
    <div>
      <PageHeader title="Payments" description={`${data?.total || 0} payment records`} actions={
        <Can permission="payments.create">
          <Button onClick={() => { setEditing(null); setFormOpen(true) }}>
            <Plus className="h-4 w-4" /> Record Payment
          </Button>
        </Can>
      } />
      <DataTable data={data?.data || []} columns={columns} searchPlaceholder="Search payments..." exportFilename="payments" loading={isLoading} />

      <EntityFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={async (form) => {
          const client = clients?.data.find((c) => c.id === form.clientId)
          const invoice = invoices?.data.find((i) => i.id === form.invoiceId)
          await handleSubmit({
            ...form,
            clientName: client?.name || form.clientName,
            invoiceNumber: invoice?.invoiceNumber || form.invoiceNumber,
          })
        }}
        title={editing ? 'Edit Payment' : 'Record Payment'}
        fields={fields}
        schema={paymentSchema}
        defaultValues={defaults}
        loading={saving}
        draftKey={editing ? `payment-${editing.id}` : 'payment-create'}
      />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleteMutation.mutate()}
        title="Delete Payment"
        message={`Delete payment ${deleting?.reference}? You can undo shortly.`}
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
