import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { type ColumnDef } from '@tanstack/react-table'
import { Plus, LayoutGrid, List, Eye } from 'lucide-react'
import toast from 'react-hot-toast'
import { ClientService } from '@/services'
import { clientRepository } from '@/repositories'
import { deleteWithUndo, formatCurrency, formatDate, invalidateAfterMutation } from '@/utils'
import { COLLECTION } from '@/db'
import {
  PageHeader, DataTable, Badge, Avatar, Button, Card, Can,
  EntityFormModal, ConfirmDialog, RowActions, type FormField,
} from '@/components/common'
import { clientSchema, type ClientForm } from '@/schemas/entities'
import type { Client } from '@/types'
import { SettingsService } from '@/services/settingsService'
import { useAuth } from '@/hooks/useAuth'

const clientFields: FormField[] = [
  { name: 'name', label: 'Client Name', required: true },
  { name: 'contactPerson', label: 'Contact Person', required: true },
  { name: 'email', label: 'Email', type: 'email', required: true },
  { name: 'phone', label: 'Phone', type: 'tel', required: true },
  { name: 'pan', label: 'PAN', required: true },
  { name: 'gstin', label: 'GSTIN', required: true },
  { name: 'type', label: 'Type', type: 'select', options: [
    { label: 'Company', value: 'company' }, { label: 'Individual', value: 'individual' },
  ]},
  { name: 'status', label: 'Status', type: 'select', options: [
    { label: 'Active', value: 'active' }, { label: 'Inactive', value: 'inactive' }, { label: 'Prospect', value: 'prospect' },
  ]},
  { name: 'city', label: 'City', required: true },
  { name: 'state', label: 'State', required: true },
  { name: 'address', label: 'Address', type: 'textarea', colSpan: 2 },
  { name: 'notes', label: 'Notes', type: 'textarea', colSpan: 2 },
]

export default function ClientsPage() {
  const [view, setView] = useState<'list' | 'grid'>('list')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)
  const [deleting, setDeleting] = useState<Client | null>(null)
  const [saving, setSaving] = useState(false)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const { data, isLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: () => ClientService.getAll({ pageSize: 500 }),
  })

  const invalidate = () => invalidateAfterMutation(queryClient, ['clients', 'clients-options'])

  const openCreate = () => { setEditing(null); setFormOpen(true) }
  const openEdit = (c: Client) => { setEditing(c); setFormOpen(true) }

  const handleSubmit = async (form: ClientForm) => {
    setSaving(true)
    try {
      if (await clientRepository.isDuplicatePan(form.pan, editing?.id)) {
        throw new Error(`Client with PAN ${form.pan} already exists`)
      }
      if (await clientRepository.isDuplicateGstin(form.gstin, editing?.id)) {
        throw new Error(`Client with GSTIN ${form.gstin} already exists`)
      }

      if (editing) {
        await ClientService.update(editing.id, form)
        toast.success('Client updated')
        await SettingsService.logAudit('update', 'clients', `Updated ${form.name}`, user?.id, user?.fullName)
      } else {
        await ClientService.create({
          ...form,
          address: form.address || '',
          pincode: '',
          assignedTo: user?.employeeId || '',
          services: ['GST Filing'],
          revenue: 0,
          outstanding: 0,
          tags: ['new'],
        })
        toast.success('Client created')
        await SettingsService.logAudit('create', 'clients', `Created ${form.name}`, user?.id, user?.fullName)
      }
      setFormOpen(false)
      invalidate()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save client')
    } finally {
      setSaving(false)
    }
  }

  const { data: deleteImpact = null } = useQuery({
    queryKey: ['client-delete-impact', deleting?.id],
    queryFn: () => clientRepository.getDeleteImpact(deleting!.id),
    enabled: !!deleting,
  })

  const handleHardDelete = async () => {
    if (!deleting) return
    const impact = deleteImpact || (await clientRepository.getDeleteImpact(deleting.id))
    const record = { ...deleting } as unknown as Record<string, unknown> & { id: string }
    deleteWithUndo({
      collection: COLLECTION.clients,
      record,
      label: deleting.name,
      performDelete: async () => {
        if (impact && !impact.canHardDelete) {
          await clientRepository.archive(deleting.id)
        } else {
          await ClientService.delete(deleting.id)
        }
      },
      onRestored: invalidate,
    })
    setDeleting(null)
    invalidate()
  }

  const handleArchive = async () => {
    if (!deleting) return
    await clientRepository.archive(deleting.id)
    toast.success(`${deleting.name} archived`)
    setDeleting(null)
    invalidate()
  }

  const deleteMutation = useMutation({
    mutationFn: async () => handleHardDelete(),
  })

  const columns: ColumnDef<Client, unknown>[] = useMemo(() => [
    {
      accessorKey: 'name',
      header: 'Client',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <Avatar name={row.original.name} size="sm" />
          <div>
            <p className="font-medium text-gray-900 dark:text-gray-100">{row.original.name}</p>
            <p className="text-xs text-gray-500">{row.original.contactPerson}</p>
          </div>
        </div>
      ),
    },
    { accessorKey: 'email', header: 'Email' },
    { accessorKey: 'phone', header: 'Phone' },
    { accessorKey: 'pan', header: 'PAN' },
    { accessorKey: 'city', header: 'City' },
    {
      accessorKey: 'revenue',
      header: 'Revenue',
      cell: ({ getValue }) => formatCurrency(getValue() as number),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => <Badge status={getValue() as string} />,
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex items-center">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/clients/${row.original.id}`)} title="View">
            <Eye className="h-4 w-4" />
          </Button>
          <RowActions
            onEdit={() => openEdit(row.original)}
            onDelete={() => setDeleting(row.original)}
            onDuplicate={async () => {
              try {
                await ClientService.duplicate(row.original.id, { name: `${row.original.name} (Copy)` })
                toast.success('Client duplicated')
                invalidate()
              } catch (e) {
                toast.error(e instanceof Error ? e.message : 'Duplicate failed')
              }
            }}
            editPermission="clients.edit"
            deletePermission="clients.delete"
          />
        </div>
      ),
    },
  ], [navigate])

  const defaults = editing
    ? {
        name: editing.name,
        contactPerson: editing.contactPerson,
        email: editing.email,
        phone: editing.phone,
        pan: editing.pan,
        gstin: editing.gstin,
        type: editing.type as 'company' | 'individual',
        status: editing.status as 'active' | 'inactive' | 'prospect',
        city: editing.city,
        state: editing.state,
        address: editing.address,
        notes: editing.notes,
      }
    : {
        type: 'company' as const,
        status: 'active' as const,
        city: 'Mumbai',
        state: 'Maharashtra',
      }

  return (
    <div>
      <PageHeader
        title="Clients"
        description={`Manage your ${data?.total || 0} clients`}
        actions={
          <>
            <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
              <button type="button" onClick={() => setView('list')} aria-label="List view" aria-pressed={view === 'list'} className={`p-2 ${view === 'list' ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/30' : 'text-gray-400'}`}>
                <List className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => setView('grid')} aria-label="Grid view" aria-pressed={view === 'grid'} className={`p-2 ${view === 'grid' ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/30' : 'text-gray-400'}`}>
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
            <Can permission="clients.create">
              <Button onClick={openCreate}><Plus className="h-4 w-4" /> Add Client</Button>
            </Can>
          </>
        }
      />

      {view === 'list' ? (
        <DataTable data={data?.data || []} columns={columns} searchPlaceholder="Search clients..." exportFilename="clients" loading={isLoading} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {(data?.data || []).map((client) => (
            <Card key={client.id} hover onClick={() => navigate(`/clients/${client.id}`)} className="cursor-pointer text-left w-full">
              <div className="flex items-start gap-3">
                <Avatar name={client.name} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">{client.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{client.contactPerson}</p>
                </div>
                <Badge status={client.status} />
              </div>
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Revenue</span>
                  <span className="font-medium">{formatCurrency(client.revenue)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">City</span>
                  <span>{client.city}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Since</span>
                  <span>{formatDate(client.createdAt, 'MMM YYYY')}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <EntityFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
        title={editing ? 'Edit Client' : 'Add Client'}
        fields={clientFields}
        schema={clientSchema}
        defaultValues={defaults}
        loading={saving}
        submitLabel={editing ? 'Update Client' : 'Create Client'}
      />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleteMutation.mutate()}
        onArchive={handleArchive}
        title={deleteImpact?.recommendArchive ? 'Remove Client' : 'Delete Client'}
        message={
          deleteImpact?.recommendArchive
            ? `${deleting?.name} has related records. Archive is recommended to preserve data integrity.`
            : `Delete ${deleting?.name}? You can undo this for a few seconds.`
        }
        warnings={deleteImpact?.warnings || []}
        preferArchive={!!deleteImpact?.recommendArchive}
        confirmLabel={deleteImpact?.canHardDelete ? 'Delete permanently' : 'Force remove'}
        archiveLabel="Archive instead"
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
