import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { CalendarDays, Columns3, Inbox, LayoutDashboard, List, Plus, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { PageHeader, DataTable, Badge, Button, Can } from '@/components/common'
import {
  WorkService,
  PRACTICE_STATUSES,
  type WorkItem,
  type PracticeStatus,
} from '@/services/workService'
import { formatDate } from '@/utils'
import { cn } from '@/utils'
import { formatPracticeStatus, overlayBadgeClass, practiceStatusClass, riskBadgeClass } from '@/utils/practiceStatus'

export default function WorkListPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [priority, setPriority] = useState('')
  const [department, setDepartment] = useState('')
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({
    title: '', description: '', assignedTo: '', assignedToName: '', assigneeRole: 'employee',
    priority: 'medium', department: '', clientName: '', clientId: '', companyId: '',
    workType: '', periodKey: '', riskClass: 'medium',
  })

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['work-items', q, status, priority, department],
    queryFn: () => WorkService.list({ page: 1, pageSize: 200, q, status, priority, department }),
  })

  const createMut = useMutation({
    mutationFn: () => WorkService.create({
      title: form.title,
      description: form.description,
      assignedTo: form.assignedTo || 'self',
      assignedToName: form.assignedToName || form.assignedTo,
      assigneeRole: form.assigneeRole,
      priority: form.priority,
      department: form.department,
      clientName: form.clientName,
      clientId: form.clientId || undefined,
      companyId: form.companyId || undefined,
      workType: form.workType || undefined,
      periodKey: form.periodKey || undefined,
      riskClass: form.riskClass,
      tags: [],
      status: 'OPEN',
    }),
    onSuccess: () => {
      toast.success('Work created')
      setCreating(false)
      qc.invalidateQueries({ queryKey: ['work-items'] })
    },
    onError: (e: Error) => toast.error(e.message || 'Create failed'),
  })

  const columns: ColumnDef<WorkItem, unknown>[] = useMemo(() => [
    {
      accessorKey: 'title',
      header: 'Work',
      cell: ({ row }) => (
        <button type="button" className="text-left font-medium text-primary-700 dark:text-primary-300 hover:underline" onClick={() => navigate(`/work/${row.original.id}`)}>
          {row.original.title}
          {row.original.periodKey ? <span className="ml-2 text-xs text-gray-400">{row.original.periodKey}</span> : null}
          {row.original.childCount ? <span className="ml-2 text-xs text-gray-400">({row.original.childCount} sub)</span> : null}
        </button>
      ),
    },
    {
      id: 'clientCompany',
      header: 'Client / Company',
      cell: ({ row }) => (
        <div className="text-sm">
          <div>{row.original.clientName || '—'}</div>
          {row.original.companyId && (
            <div className="text-xs text-gray-400 truncate max-w-[140px]" title={row.original.companyId}>
              Co: {row.original.companyId}
            </div>
          )}
        </div>
      ),
    },
    {
      id: 'triad',
      header: 'Ownership',
      cell: ({ row }) => (
        <div className="text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
          <div>CA: {row.original.ownerCaId || '—'}</div>
          <div>TL: {row.original.tlId || '—'}</div>
          <div>Asn: {row.original.assignedToName || row.original.assigneeId || row.original.assignedTo || '—'}</div>
        </div>
      ),
    },
    { accessorKey: 'department', header: 'Dept' },
    {
      accessorKey: 'priority',
      header: 'Priority',
      cell: ({ getValue }) => <Badge>{String(getValue())}</Badge>,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <div className="flex flex-col gap-1 items-start">
          <span className={practiceStatusClass(row.original.status)}>
            {formatPracticeStatus(row.original.status)}
          </span>
          {row.original.overlay && (
            <span className={overlayBadgeClass()}>{row.original.overlay.replace(/_/g, ' ')}</span>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'riskClass',
      header: 'Risk',
      cell: ({ getValue }) => {
        const v = String(getValue() || '')
        if (!v) return '—'
        return <span className={cn('px-2 py-0.5 rounded-md text-xs font-medium capitalize', riskBadgeClass(v))}>{v}</span>
      },
    },
    {
      accessorKey: 'dueDate',
      header: 'Due',
      cell: ({ getValue }) => {
        const v = getValue()
        return v ? formatDate(String(v)) : '—'
      },
    },
  ], [navigate])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Work Management"
        description="Practice Core — gated delivery (TL → CA → Manager Close)"
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/work/dashboard"><Button variant="secondary"><LayoutDashboard className="h-4 w-4" /> Dashboard</Button></Link>
            <Link to="/work/board"><Button variant="secondary"><Columns3 className="h-4 w-4" /> Board</Button></Link>
            <Link to="/work/intake"><Button variant="secondary"><Inbox className="h-4 w-4" /> Intake</Button></Link>
            <Link to="/work/calendar"><Button variant="secondary"><CalendarDays className="h-4 w-4" /> Calendar</Button></Link>
            <Link to="/work/timeline"><Button variant="secondary"><List className="h-4 w-4" /> Timeline</Button></Link>
            <Link to="/work/team"><Button variant="secondary">Team</Button></Link>
            <Can permission="work.create">
              <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New Work</Button>
            </Can>
          </div>
        }
      />

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
            placeholder="Search work…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm px-3 py-2" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {PRACTICE_STATUSES.map((s: PracticeStatus) => (
            <option key={s} value={s}>{formatPracticeStatus(s)}</option>
          ))}
        </select>
        <select className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm px-3 py-2" value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="">All priorities</option>
          {['low', 'medium', 'high', 'urgent'].map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <input
          className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm px-3 py-2"
          placeholder="Department"
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
        />
      </div>

      {isError && (
        <p className="text-sm text-red-600">{(error as Error)?.message || 'Failed to load work'}</p>
      )}
      <DataTable columns={columns} data={data?.items || []} loading={isLoading} />

      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-gray-900 p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Create work</h3>
            {(['title', 'description', 'assignedTo', 'assignedToName', 'department', 'clientName', 'clientId', 'companyId', 'workType', 'periodKey'] as const).map((k) => (
              <input
                key={k}
                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm"
                placeholder={k}
                value={form[k]}
                onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
              />
            ))}
            <select className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm" value={form.assigneeRole} onChange={(e) => setForm((f) => ({ ...f, assigneeRole: e.target.value }))}>
              <option value="employee">Employee</option>
              <option value="accountant">Accountant</option>
              <option value="article_assistant">Article</option>
              <option value="junior_ca">Junior CA</option>
              <option value="team_leader">Team Leader</option>
              <option value="ca">CA</option>
              <option value="manager">Manager</option>
            </select>
            <select className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm" value={form.riskClass} onChange={(e) => setForm((f) => ({ ...f, riskClass: e.target.value }))}>
              <option value="low">Risk: low</option>
              <option value="medium">Risk: medium</option>
              <option value="high">Risk: high</option>
            </select>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setCreating(false)}>Cancel</Button>
              <Button disabled={!form.title || createMut.isPending} onClick={() => createMut.mutate()}>Create</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
