import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Calendar, User, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { ComplianceService, ClientService } from '@/services'
import {
  PageHeader, Badge, DashboardSkeleton, Button, Can, EntityFormModal, ConfirmDialog, type FormField,
} from '@/components/common'
import { COMPLIANCE_COLUMNS } from '@/constants/status'
import { formatDate, invalidateAfterMutation } from '@/utils'
import { complianceSchema, type ComplianceForm } from '@/schemas/entities'
import type { ComplianceRecord } from '@/types'

function KanbanCard({
  item,
  onMove,
  onDelete,
}: {
  item: ComplianceRecord
  onMove: (id: string, status: ComplianceRecord['status']) => void
  onDelete: (item: ComplianceRecord) => void
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-4 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between mb-2">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{item.clientName}</p>
        <Badge priority={item.priority} variant="priority" />
      </div>
      <p className="text-xs text-gray-500 mb-3">{item.service}</p>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <User className="h-3 w-3" />
          <span>{item.assignedToName}</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-orange-600">
          <Calendar className="h-3 w-3" />
          {formatDate(item.dueDate, 'DD MMM')}
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {COMPLIANCE_COLUMNS.filter((c) => c.id !== item.status).map((col) => (
          <button
            key={col.id}
            onClick={() => onMove(item.id, col.id as ComplianceRecord['status'])}
            className="text-[10px] px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-primary-50 dark:hover:bg-primary-900/30 hover:text-primary-700 dark:hover:text-primary-300"
          >
            → {col.title}
          </button>
        ))}
        <button onClick={() => onDelete(item)} className="text-[10px] px-2 py-0.5 rounded-md bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/50">
          Delete
        </button>
      </div>
    </motion.div>
  )
}

export default function CompliancePage() {
  const [formOpen, setFormOpen] = useState(false)
  const [deleting, setDeleting] = useState<ComplianceRecord | null>(null)
  const [saving, setSaving] = useState(false)
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['compliance-kanban'],
    queryFn: () => ComplianceService.getKanban(),
  })
  const { data: clients } = useQuery({
    queryKey: ['clients-options'],
    queryFn: () => ClientService.getAll({ pageSize: 500 }),
  })

  const invalidate = () => invalidateAfterMutation(queryClient, ['compliance-kanban', 'compliance'])

  const handleMove = async (id: string, status: ComplianceRecord['status']) => {
    try {
      await ComplianceService.updateStatus(id, status)
      toast.success(`Moved to ${status.replace(/_/g, ' ')}`)
      invalidate()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update')
    }
  }

  const fields: FormField[] = [
    { name: 'clientId', label: 'Client', type: 'select', options: (clients?.data || []).map((c) => ({ label: c.name, value: c.id })), required: true, syncLabelTo: 'clientName' },
    { name: 'clientName', label: 'Client Name', hidden: true },
    { name: 'service', label: 'Service', type: 'select', options: [
      { label: 'GST Filing', value: 'GST Filing' }, { label: 'ITR Filing', value: 'ITR Filing' },
      { label: 'TDS Return', value: 'TDS Return' }, { label: 'ROC Filing', value: 'ROC Filing' },
      { label: 'Audit', value: 'Audit' },
    ]},
    { name: 'priority', label: 'Priority', type: 'select', options: [
      { label: 'Low', value: 'low' }, { label: 'Medium', value: 'medium' },
      { label: 'High', value: 'high' }, { label: 'Urgent', value: 'urgent' },
    ]},
    { name: 'status', label: 'Status', type: 'select', options: [
      { label: 'Upcoming', value: 'upcoming' }, { label: 'In Progress', value: 'in_progress' },
      { label: 'Waiting Client', value: 'waiting_client' }, { label: 'Completed', value: 'completed' },
    ]},
    { name: 'dueDate', label: 'Due Date', type: 'date', required: true },
    { name: 'assignedToName', label: 'Assigned To' },
    { name: 'description', label: 'Description', type: 'textarea', colSpan: 2 },
  ]

  if (isLoading || !data) return <DashboardSkeleton />

  return (
    <div>
      <PageHeader
        title="Compliance"
        description="Track and manage all compliance tasks across clients"
        actions={
          <Can permission="compliance.create">
            <Button onClick={() => setFormOpen(true)}><Plus className="h-4 w-4" /> Add Task</Button>
          </Can>
        }
      />

      <div className="kanban-scroll scrollbar-thin">
        {COMPLIANCE_COLUMNS.map((col) => {
          const items = data[col.id as keyof typeof data] || []
          return (
            <div key={col.id} className="kanban-column space-y-3">
              <div className={`flex items-center justify-between px-1 border-t-2 ${col.color} pt-3`}>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{col.title}</h3>
                <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">{items.length}</span>
              </div>
              <div className="space-y-3 min-h-[200px]">
                {items.slice(0, 12).map((item) => (
                  <KanbanCard key={item.id} item={item} onMove={handleMove} onDelete={setDeleting} />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <EntityFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={async (form: ComplianceForm) => {
          setSaving(true)
          try {
            const client = clients?.data.find((c) => c.id === form.clientId)
            await ComplianceService.create({
              ...form,
              clientName: client?.name || form.clientName,
              assignedTo: '',
              tags: ['monthly'],
            })
            toast.success('Compliance task created')
            setFormOpen(false)
            invalidate()
          } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Failed')
          } finally {
            setSaving(false)
          }
        }}
        title="Add Compliance Task"
        fields={fields}
        schema={complianceSchema}
        defaultValues={{
          priority: 'medium',
          status: 'upcoming',
          dueDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
          clientName: '',
          service: 'GST Filing',
        }}
        loading={saving}
      />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return
          await ComplianceService.delete(deleting.id)
          toast.success('Deleted')
          setDeleting(null)
          invalidate()
        }}
        title="Delete Compliance Task"
        message={`Delete task for ${deleting?.clientName}?`}
        confirmLabel="Delete"
      />
    </div>
  )
}
