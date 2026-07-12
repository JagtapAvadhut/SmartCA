import { useMemo, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Mail, Phone, MapPin, FileText, CreditCard, Shield, Clock,
  CheckSquare, Activity as ActivityIcon, Pencil, Plus,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  ClientService, InvoiceService, PaymentService, DocumentService, TaskService,
} from '@/services'
import { COLLECTION, getCollection } from '@/db'
import { Button, Card, CardTitle, Badge, Avatar, TableSkeleton, Input, EntityFormModal, type FormField } from '@/components/common'
import { formatCurrency, formatDate, formatRelativeTime, invalidateAfterMutation, cn } from '@/utils'
import { z } from 'zod'

type Tab = 'overview' | 'invoices' | 'payments' | 'compliance' | 'tasks' | 'documents' | 'notes' | 'activity'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'invoices', label: 'Invoices' },
  { id: 'payments', label: 'Payments' },
  { id: 'compliance', label: 'Compliance' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'documents', label: 'Documents' },
  { id: 'notes', label: 'Notes' },
  { id: 'activity', label: 'Activity' },
]

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) || 'overview'
  const queryClient = useQueryClient()
  const [editingNotes, setEditingNotes] = useState(false)
  const [notes, setNotes] = useState('')
  const [quickTaskOpen, setQuickTaskOpen] = useState(false)
  const [savingTask, setSavingTask] = useState(false)

  const setTab = (id: Tab) => {
    const next = new URLSearchParams(params)
    next.set('tab', id)
    setParams(next)
  }

  const { data: client, isLoading } = useQuery({
    queryKey: ['client', id],
    queryFn: () => ClientService.getById(id!),
    enabled: !!id,
  })

  const { data: invoices } = useQuery({ queryKey: ['client-invoices', id], queryFn: () => InvoiceService.getByClient(id!), enabled: !!id })
  const { data: payments } = useQuery({ queryKey: ['client-payments', id], queryFn: () => PaymentService.getByClient(id!), enabled: !!id })
  const { data: documents } = useQuery({ queryKey: ['client-documents', id], queryFn: () => DocumentService.getByClient(id!), enabled: !!id })
  const { data: tasks } = useQuery({
    queryKey: ['client-tasks', id],
    queryFn: async () => getCollection(COLLECTION.tasks).find({ filter: { clientId: id }, pageSize: 100 }),
    enabled: !!id,
  })
  const { data: compliance } = useQuery({
    queryKey: ['client-compliance', id],
    queryFn: async () => getCollection(COLLECTION.compliance).find({ filter: { clientId: id }, pageSize: 100 }),
    enabled: !!id,
  })
  const { data: activities } = useQuery({
    queryKey: ['client-activity', id],
    queryFn: async () => getCollection(COLLECTION.activities).find({ filter: { clientId: id }, sortBy: 'timestamp', sortOrder: 'desc', pageSize: 30 }),
    enabled: !!id,
  })

  const saveNotes = useMutation({
    mutationFn: async () => ClientService.update(id!, { notes }),
    onSuccess: () => {
      toast.success('Notes saved')
      setEditingNotes(false)
      invalidateAfterMutation(queryClient, ['client', 'clients'])
      void queryClient.invalidateQueries({ queryKey: ['client', id] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const taskFields: FormField[] = useMemo(() => [
    { name: 'title', label: 'Task Title', required: true, colSpan: 2 },
    { name: 'dueDate', label: 'Due Date', type: 'date', required: true },
    { name: 'priority', label: 'Priority', type: 'select', options: [
      { label: 'Low', value: 'low' }, { label: 'Medium', value: 'medium' }, { label: 'High', value: 'high' }, { label: 'Urgent', value: 'urgent' },
    ]},
    { name: 'status', label: 'Status', type: 'select', options: [
      { label: 'Todo', value: 'todo' }, { label: 'In Progress', value: 'in_progress' }, { label: 'Completed', value: 'completed' },
    ]},
  ], [])

  if (isLoading || !client) return <TableSkeleton />

  const goCreateInvoice = () => navigate(`/invoices?clientId=${client.id}&create=1`)
  const goUploadDoc = () => navigate(`/documents?clientId=${client.id}&upload=1`)
  const goPayments = () => navigate(`/payments?clientId=${client.id}`)

  return (
    <div className="space-y-4">
      <button type="button" onClick={() => navigate('/clients')} className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
        <ArrowLeft className="h-4 w-4" /> Back to Clients
      </button>

      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <Avatar name={client.name} size="lg" />
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 truncate">{client.name}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{client.contactPerson}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge status={client.status} />
              <Badge>{client.type}</Badge>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={goCreateInvoice}><Plus className="h-4 w-4" /> Invoice</Button>
          <Button size="sm" variant="outline" onClick={goPayments}>Payments</Button>
          <Button size="sm" variant="outline" onClick={goUploadDoc}>Upload Doc</Button>
          <Button size="sm" variant="outline" onClick={() => setQuickTaskOpen(true)}>Add Task</Button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {TABS.map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)} className={cn(
            'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border',
            tab === t.id
              ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border-primary-200 dark:border-primary-800'
              : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700'
          )}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-1 space-y-3">
            <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300"><Mail className="h-4 w-4 text-gray-400" /> {client.email}</div>
            <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300"><Phone className="h-4 w-4 text-gray-400" /> {client.phone}</div>
            <div className="flex items-start gap-3 text-sm text-gray-600 dark:text-gray-300"><MapPin className="h-4 w-4 text-gray-400 mt-0.5" /> {client.address}</div>
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
              <div><p className="text-xs text-gray-500">PAN</p><p className="text-sm font-medium text-gray-900 dark:text-gray-100">{client.pan}</p></div>
              <div><p className="text-xs text-gray-500">GSTIN</p><p className="text-sm font-medium text-gray-900 dark:text-gray-100">{client.gstin}</p></div>
              <div><p className="text-xs text-gray-500">Revenue</p><p className="text-sm font-semibold text-emerald-600">{formatCurrency(client.revenue)}</p></div>
              <div><p className="text-xs text-gray-500">Outstanding</p><p className="text-sm font-semibold text-orange-600">{formatCurrency(client.outstanding)}</p></div>
            </div>
          </Card>
          <Card className="lg:col-span-2">
            <CardTitle className="mb-3 flex items-center gap-2"><ActivityIcon className="h-4 w-4" /> Timeline</CardTitle>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {(activities || []).slice(0, 12).map((a) => (
                <div key={a.id} className="flex gap-3">
                  <div className="mt-1 h-2 w-2 rounded-full bg-primary-500 shrink-0" />
                  <div>
                    <p className="text-sm text-gray-900 dark:text-gray-100">{String(a.message)}</p>
                    <p className="text-xs text-gray-400">{formatRelativeTime(String(a.timestamp))}</p>
                  </div>
                </div>
              ))}
              {!activities?.length && <p className="text-sm text-gray-500 dark:text-gray-400">No activity yet for this client.</p>}
            </div>
          </Card>
        </div>
      )}

      {tab === 'invoices' && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <CardTitle className="flex items-center gap-2"><FileText className="h-4 w-4" /> Invoices ({invoices?.length || 0})</CardTitle>
            <Button size="sm" onClick={goCreateInvoice}><Plus className="h-4 w-4" /> New</Button>
          </div>
          <div className="space-y-2">
            {(invoices || []).map((inv) => (
              <button key={inv.id} type="button" onClick={() => navigate(`/invoices?q=${encodeURIComponent(inv.invoiceNumber)}`)} className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 text-left">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{inv.invoiceNumber}</p>
                  <p className="text-xs text-gray-500">{formatDate(inv.issueDate)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(inv.total)}</p>
                  <Badge status={inv.status} />
                </div>
              </button>
            ))}
            {!invoices?.length && <p className="text-sm text-gray-500">No invoices. Create one with client prefilled.</p>}
          </div>
        </Card>
      )}

      {tab === 'payments' && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <CardTitle className="flex items-center gap-2"><CreditCard className="h-4 w-4" /> Payments ({payments?.length || 0})</CardTitle>
            <Button size="sm" onClick={goPayments}>Record Payment</Button>
          </div>
          <div className="space-y-2">
            {(payments || []).map((pay) => (
              <div key={pay.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{pay.reference}</p>
                  <p className="text-xs text-gray-500">{formatDate(pay.paymentDate)}</p>
                </div>
                <p className="text-sm font-semibold text-emerald-600">{formatCurrency(pay.amount)}</p>
              </div>
            ))}
            {!payments?.length && <p className="text-sm text-gray-500">No payments yet.</p>}
          </div>
        </Card>
      )}

      {tab === 'compliance' && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <CardTitle className="flex items-center gap-2"><Shield className="h-4 w-4" /> Compliance ({compliance?.length || 0})</CardTitle>
            <Button size="sm" variant="outline" onClick={() => navigate('/compliance')}>Open Board</Button>
          </div>
          <div className="space-y-2">
            {(compliance || []).map((c) => (
              <div key={c.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{String(c.service)}</p>
                  <p className="text-xs text-gray-500">Due {formatDate(String(c.dueDate))}</p>
                </div>
                <Badge status={String(c.status)} />
              </div>
            ))}
            {!compliance?.length && <p className="text-sm text-gray-500">No compliance items linked.</p>}
          </div>
        </Card>
      )}

      {tab === 'tasks' && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <CardTitle className="flex items-center gap-2"><CheckSquare className="h-4 w-4" /> Tasks ({tasks?.length || 0})</CardTitle>
            <Button size="sm" onClick={() => setQuickTaskOpen(true)}><Plus className="h-4 w-4" /> Task</Button>
          </div>
          <div className="space-y-2">
            {(tasks || []).map((t) => (
              <div key={t.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{String(t.title)}</p>
                  <p className="text-xs text-gray-500">Due {formatDate(String(t.dueDate))}</p>
                </div>
                <Badge status={String(t.status)} />
              </div>
            ))}
            {!tasks?.length && <p className="text-sm text-gray-500">No tasks. Add one for this client.</p>}
          </div>
        </Card>
      )}

      {tab === 'documents' && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <CardTitle>Documents ({documents?.length || 0})</CardTitle>
            <Button size="sm" onClick={goUploadDoc}>Upload</Button>
          </div>
          <div className="space-y-2">
            {(documents || []).map((doc) => (
              <div key={doc.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{doc.name}</p>
                  <p className="text-xs text-gray-500">{doc.folder}</p>
                </div>
                <p className="text-xs text-gray-400">{formatDate(doc.uploadedAt)}</p>
              </div>
            ))}
            {!documents?.length && <p className="text-sm text-gray-500">No documents yet.</p>}
          </div>
        </Card>
      )}

      {tab === 'notes' && (
        <Card>
          <CardTitle className="mb-4 flex items-center justify-between">
            <span className="flex items-center gap-2"><Clock className="h-4 w-4" /> Notes</span>
            {!editingNotes && (
              <Button variant="ghost" size="sm" onClick={() => { setNotes(client.notes || ''); setEditingNotes(true) }}>
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
            )}
          </CardTitle>
          {editingNotes ? (
            <div className="space-y-3">
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditingNotes(false)}>Cancel</Button>
                <Button loading={saveNotes.isPending} onClick={() => saveNotes.mutate()}>Save Notes</Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{client.notes || 'No notes yet.'}</p>
          )}
        </Card>
      )}

      {tab === 'activity' && (
        <Card>
          <CardTitle className="mb-4">Activity</CardTitle>
          <div className="space-y-3">
            {(activities || []).map((a) => (
              <div key={a.id} className="p-3 rounded-xl border border-gray-100 dark:border-gray-800">
                <p className="text-sm text-gray-900 dark:text-gray-100">{String(a.message)}</p>
                <p className="text-xs text-gray-400 mt-1">{formatRelativeTime(String(a.timestamp))} · {String(a.userName || 'System')}</p>
              </div>
            ))}
            {!activities?.length && <p className="text-sm text-gray-500">No activity logged.</p>}
          </div>
        </Card>
      )}

      <EntityFormModal
        open={quickTaskOpen}
        onClose={() => setQuickTaskOpen(false)}
        title="Add Task"
        fields={taskFields}
        schema={z.object({
          title: z.string().min(2),
          dueDate: z.string().min(1),
          priority: z.enum(['low', 'medium', 'high', 'urgent']),
          status: z.enum(['todo', 'in_progress', 'completed', 'cancelled']).optional(),
        })}
        defaultValues={{
          priority: 'medium',
          status: 'todo',
          dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
        }}
        loading={savingTask}
        onSubmit={async (form) => {
          setSavingTask(true)
          try {
            await TaskService.create({
              ...form,
              clientId: client.id,
              clientName: client.name,
              description: '',
              assignedTo: '',
              assignedToName: 'Unassigned',
              category: 'compliance',
            })
            toast.success('Task created')
            setQuickTaskOpen(false)
            invalidateAfterMutation(queryClient, ['client-tasks', 'tasks'])
            void queryClient.invalidateQueries({ queryKey: ['client-tasks', id] })
          } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Failed')
          } finally {
            setSavingTask(false)
          }
        }}
      />
    </div>
  )
}
