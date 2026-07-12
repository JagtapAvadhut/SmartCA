import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { CompanyService, ClientService } from '@/services'
import { companyRepository } from '@/repositories'
import { COLLECTION } from '@/db'
import {
  PageHeader, DataTable, Badge, Button, Can, EntityFormModal, ConfirmDialog, RowActions, type FormField,
} from '@/components/common'
import { formatCurrency, formatDate, deleteWithUndo, invalidateAfterMutation } from '@/utils'
import { companySchema, type CompanyForm } from '@/schemas/entities'
import type { Company } from '@/types'

export default function CompaniesPage() {
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Company | null>(null)
  const [deleting, setDeleting] = useState<Company | null>(null)
  const [saving, setSaving] = useState(false)
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['companies'],
    queryFn: () => CompanyService.getAll({ pageSize: 500 }),
  })
  const { data: clients } = useQuery({
    queryKey: ['clients-options'],
    queryFn: () => ClientService.getAll({ pageSize: 500 }),
  })

  const invalidate = () => invalidateAfterMutation(queryClient, ['companies'])

  const fields: FormField[] = [
    { name: 'name', label: 'Company Name', required: true },
    { name: 'clientId', label: 'Linked Client', type: 'select', options: (clients?.data || []).map((c) => ({ label: c.name, value: c.id })), required: true },
    { name: 'cin', label: 'CIN', required: true },
    { name: 'pan', label: 'PAN', required: true },
    { name: 'gstin', label: 'GSTIN', required: true },
    { name: 'industry', label: 'Industry', type: 'select', options: [
      { label: 'IT', value: 'IT' }, { label: 'Manufacturing', value: 'Manufacturing' },
      { label: 'Pharma', value: 'Pharma' }, { label: 'Banking', value: 'Banking' },
      { label: 'Retail', value: 'Retail' }, { label: 'Healthcare', value: 'Healthcare' },
    ]},
    { name: 'status', label: 'Status', type: 'select', options: [
      { label: 'Active', value: 'active' }, { label: 'Inactive', value: 'inactive' }, { label: 'Dissolved', value: 'dissolved' },
    ]},
    { name: 'incorporationDate', label: 'Incorporation Date', type: 'date', required: true },
    { name: 'turnover', label: 'Turnover (₹)', type: 'number' },
  ]

  const handleSubmit = async (form: CompanyForm) => {
    setSaving(true)
    try {
      if (editing) {
        await CompanyService.update(editing.id, form)
        toast.success('Company updated')
      } else {
        await CompanyService.create(form)
        toast.success('Company created')
      }
      setFormOpen(false)
      invalidate()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const { data: deleteImpact = null } = useQuery({
    queryKey: ['company-delete-impact', deleting?.id],
    queryFn: () => companyRepository.getDeleteImpact(deleting!.id),
    enabled: !!deleting,
  })

  const handleDelete = () => {
    if (!deleting) return
    const record = { ...deleting } as unknown as Record<string, unknown> & { id: string }
    deleteWithUndo({
      collection: COLLECTION.companies,
      record,
      label: deleting.name,
      performDelete: async () => {
        await CompanyService.delete(deleting.id)
      },
      onRestored: invalidate,
    })
    setDeleting(null)
    invalidate()
  }

  const handleArchive = async () => {
    if (!deleting) return
    await companyRepository.archive(deleting.id)
    toast.success(`${deleting.name} archived`)
    setDeleting(null)
    invalidate()
  }

  const deleteMutation = useMutation({
    mutationFn: async () => handleDelete(),
  })

  const columns: ColumnDef<Company, unknown>[] = useMemo(() => [
    { accessorKey: 'name', header: 'Company' },
    { accessorKey: 'cin', header: 'CIN' },
    { accessorKey: 'industry', header: 'Industry' },
    { accessorKey: 'incorporationDate', header: 'Incorporated', cell: ({ getValue }) => formatDate(getValue() as string) },
    { accessorKey: 'directors', header: 'Directors', cell: ({ getValue }) => (getValue() as string[])?.length || 0 },
    { accessorKey: 'turnover', header: 'Turnover', cell: ({ getValue }) => formatCurrency(getValue() as number) },
    { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <Badge status={getValue() as string} /> },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <RowActions
          onEdit={() => { setEditing(row.original); setFormOpen(true) }}
          onDelete={() => setDeleting(row.original)}
          editPermission="companies.edit"
          deletePermission="companies.edit"
        />
      ),
    },
  ], [])

  const defaults = editing
    ? {
        name: editing.name, clientId: editing.clientId, cin: editing.cin, pan: editing.pan,
        gstin: editing.gstin, industry: editing.industry,
        status: editing.status as CompanyForm['status'],
        incorporationDate: editing.incorporationDate, turnover: editing.turnover,
      }
    : {
        status: 'active' as const, industry: 'IT',
        incorporationDate: new Date().toISOString().split('T')[0],
        turnover: 1000000,
      }

  return (
    <div>
      <PageHeader title="Companies" description={`${data?.total || 0} registered companies`} actions={
        <Can permission="companies.create">
          <Button onClick={() => { setEditing(null); setFormOpen(true) }}><Plus className="h-4 w-4" /> Add Company</Button>
        </Can>
      } />
      <DataTable data={data?.data || []} columns={columns} searchPlaceholder="Search companies..." exportFilename="companies" loading={isLoading} />
      <EntityFormModal open={formOpen} onClose={() => setFormOpen(false)} onSubmit={handleSubmit} title={editing ? 'Edit Company' : 'Add Company'} fields={fields} schema={companySchema} defaultValues={defaults} loading={saving} />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleteMutation.mutate()}
        onArchive={handleArchive}
        title="Delete Company"
        message={`Delete ${deleting?.name}? Linked invoices remain associated by client.`}
        warnings={deleteImpact?.warnings || []}
        preferArchive={(deleteImpact?.roc || 0) > 0}
        confirmLabel="Delete"
        archiveLabel="Archive instead"
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
