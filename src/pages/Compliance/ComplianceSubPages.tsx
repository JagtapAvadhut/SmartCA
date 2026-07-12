import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { ComplianceService } from '@/services'
import { COLLECTION, getCollection } from '@/db'
import {
  PageHeader, DataTable, Badge, Button, Can, EntityFormModal, ConfirmDialog, RowActions, type FormField,
} from '@/components/common'
import { deleteWithUndo, formatCurrency, formatDate, invalidateAfterMutation } from '@/utils'
import { z } from 'zod'
import type { GSTFiling } from '@/types'

const filingSchema = z.object({
  clientName: z.string().min(2, 'Client name is required'),
  /** GSTIN / PAN / TAN / CIN depending on filing module — demo accepts flexible IDs */
  gstin: z.string().trim().min(5, 'Registration ID required').max(21),
  returnType: z.string().min(1),
  period: z.string().min(1),
  dueDate: z.string().min(1),
  status: z.enum(['pending', 'in_progress', 'filed', 'overdue']),
  taxLiability: z.coerce.number().min(0),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
})

type FilingForm = z.infer<typeof filingSchema>

const fields: FormField[] = [
  { name: 'clientName', label: 'Client Name', required: true },
  { name: 'gstin', label: 'Registration ID', required: true },
  { name: 'returnType', label: 'Return Type', type: 'select', options: [
    { label: 'GSTR-1', value: 'GSTR-1' }, { label: 'GSTR-3B', value: 'GSTR-3B' },
    { label: 'GSTR-9', value: 'GSTR-9' }, { label: 'ITR-1', value: 'ITR-1' },
    { label: 'ITR-3', value: 'ITR-3' }, { label: '24Q', value: '24Q' }, { label: 'AOC-4', value: 'AOC-4' },
  ]},
  { name: 'period', label: 'Period', required: true },
  { name: 'dueDate', label: 'Due Date', type: 'date', required: true },
  { name: 'status', label: 'Status', type: 'select', options: [
    { label: 'Pending', value: 'pending' }, { label: 'In Progress', value: 'in_progress' },
    { label: 'Filed', value: 'filed' }, { label: 'Overdue', value: 'overdue' },
  ]},
  { name: 'taxLiability', label: 'Tax Liability (₹)', type: 'number', required: true },
  { name: 'priority', label: 'Priority', type: 'select', options: [
    { label: 'Low', value: 'low' }, { label: 'Medium', value: 'medium' },
    { label: 'High', value: 'high' }, { label: 'Urgent', value: 'urgent' },
  ]},
]

type CollectionName = typeof COLLECTION.gst | typeof COLLECTION.itr | typeof COLLECTION.tds | typeof COLLECTION.roc

function ComplianceTablePage({
  title,
  description,
  queryKey,
  collection,
  fetchFn,
}: {
  title: string
  description: string
  queryKey: string
  collection: CollectionName
  fetchFn: () => ReturnType<typeof ComplianceService.getGST>
}) {
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<GSTFiling | null>(null)
  const [deleting, setDeleting] = useState<GSTFiling | null>(null)
  const [saving, setSaving] = useState(false)
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({ queryKey: [queryKey], queryFn: fetchFn })
  const invalidate = () => invalidateAfterMutation(queryClient, [queryKey])

  const handleSubmit = async (form: FilingForm) => {
    setSaving(true)
    try {
      const col = getCollection(collection)
      if (editing) {
        col.update(editing.id, form)
        toast.success('Filing updated')
      } else {
        col.insert({
          ...form,
          clientId: '',
          filedDate: null,
          acknowledgmentNumber: null,
        })
        toast.success('Filing created')
      }
      setFormOpen(false)
      invalidate()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deleting) return
      const record = { ...deleting } as unknown as Record<string, unknown> & { id: string }
      deleteWithUndo({
        collection,
        record,
        label: `${deleting.returnType} · ${deleting.clientName}`,
        performDelete: () => { getCollection(collection).delete(deleting.id) },
        onRestored: invalidate,
      })
      setDeleting(null)
      invalidate()
    },
  })

  const columns: ColumnDef<GSTFiling, unknown>[] = useMemo(() => [
    { accessorKey: 'clientName', header: 'Client' },
    { accessorKey: 'gstin', header: 'GSTIN / Ref' },
    { accessorKey: 'returnType', header: 'Return Type' },
    { accessorKey: 'period', header: 'Period' },
    { accessorKey: 'dueDate', header: 'Due Date', cell: ({ getValue }) => formatDate(getValue() as string) },
    { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <Badge status={getValue() as string} /> },
    { accessorKey: 'taxLiability', header: 'Tax', cell: ({ getValue }) => formatCurrency(getValue() as number) },
    { accessorKey: 'priority', header: 'Priority', cell: ({ getValue }) => <Badge priority={getValue() as string} variant="priority" /> },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <RowActions
          onEdit={() => { setEditing(row.original); setFormOpen(true) }}
          onDelete={() => setDeleting(row.original)}
        />
      ),
    },
  ], [])

  const defaults = editing
    ? {
        clientName: editing.clientName,
        gstin: editing.gstin,
        returnType: editing.returnType,
        period: editing.period,
        dueDate: editing.dueDate,
        status: editing.status as FilingForm['status'],
        taxLiability: editing.taxLiability,
        priority: editing.priority as FilingForm['priority'],
      }
    : {
        returnType: 'GSTR-3B',
        status: 'pending' as const,
        priority: 'medium' as const,
        dueDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
        taxLiability: 0,
        period: new Date().toISOString().slice(0, 7),
      }

  return (
    <div>
      <PageHeader
        title={title}
        description={description}
        actions={
          <Can permission="compliance.create">
            <Button onClick={() => { setEditing(null); setFormOpen(true) }}>
              <Plus className="h-4 w-4" /> Add Filing
            </Button>
          </Can>
        }
      />
      <DataTable data={(data?.data || []) as GSTFiling[]} columns={columns} searchPlaceholder={`Search ${title}...`} exportFilename={queryKey} loading={isLoading} />
      <EntityFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
        title={editing ? 'Edit Filing' : 'Add Filing'}
        fields={fields}
        schema={filingSchema}
        defaultValues={defaults}
        loading={saving}
      />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleteMutation.mutate()}
        title="Delete Filing"
        message={`Delete ${deleting?.returnType} for ${deleting?.clientName}?`}
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
      />
    </div>
  )
}

export function GSTPage() {
  return (
    <ComplianceTablePage
      title="GST Filings"
      description="Manage GST return filings"
      queryKey="gst"
      collection={COLLECTION.gst}
      fetchFn={() => ComplianceService.getGST({ pageSize: 200 })}
    />
  )
}

export function ITRPage() {
  return (
    <ComplianceTablePage
      title="Income Tax Returns"
      description="Manage ITR filings"
      queryKey="itr"
      collection={COLLECTION.itr}
      fetchFn={() => ComplianceService.getITR({ pageSize: 200 }) as never}
    />
  )
}

export function TDSPage() {
  return (
    <ComplianceTablePage
      title="TDS Returns"
      description="Manage TDS return filings"
      queryKey="tds"
      collection={COLLECTION.tds}
      fetchFn={() => ComplianceService.getTDS({ pageSize: 200 }) as never}
    />
  )
}

export function ROCPage() {
  return (
    <ComplianceTablePage
      title="ROC Filings"
      description="Manage ROC annual filings"
      queryKey="roc"
      collection={COLLECTION.roc}
      fetchFn={() => ComplianceService.getROC({ pageSize: 200 }) as never}
    />
  )
}
