import { useState } from 'react'
import { Link } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Plus } from 'lucide-react'
import { PageHeader, Button, Badge, Can } from '@/components/common'
import { WorkService, type Intake } from '@/services/workService'
import { formatDate } from '@/utils'
import { cn } from '@/utils'

const SOURCES = ['walk_in', 'phone', 'email', 'referral', 'other'] as const

function intakeStatusClass(status: string): string {
  const s = (status || '').toUpperCase()
  if (s === 'APPROVED') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
  if (s === 'REJECTED') return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
  return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
}

export default function WorkIntakePage() {
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('INTAKE')
  const [creating, setCreating] = useState(false)
  const [approving, setApproving] = useState<Intake | null>(null)
  const [rejecting, setRejecting] = useState<Intake | null>(null)
  const [rejectRemarks, setRejectRemarks] = useState('')
  const [form, setForm] = useState({
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    source: 'walk_in',
    services: 'GST',
    notes: '',
  })
  const [approveForm, setApproveForm] = useState({
    clientId: '',
    companyId: '',
    ownerCaId: '',
    engagementTitle: '',
    services: '',
  })

  const { data: intakes = [], isLoading, isError, error } = useQuery({
    queryKey: ['work-intakes', statusFilter],
    queryFn: () => WorkService.listIntakes({ status: statusFilter || undefined }),
  })

  const createMut = useMutation({
    mutationFn: () => WorkService.createIntake({
      contactName: form.contactName,
      contactPhone: form.contactPhone || undefined,
      contactEmail: form.contactEmail || undefined,
      source: form.source,
      services: form.services.split(',').map((s) => s.trim()).filter(Boolean),
      notes: form.notes || undefined,
    }),
    onSuccess: () => {
      toast.success('Intake created')
      setCreating(false)
      setForm({ contactName: '', contactPhone: '', contactEmail: '', source: 'walk_in', services: 'GST', notes: '' })
      qc.invalidateQueries({ queryKey: ['work-intakes'] })
    },
    onError: (e: Error) => toast.error(e.message || 'Create failed'),
  })

  const approveMut = useMutation({
    mutationFn: () => {
      if (!approving) throw new Error('No intake selected')
      return WorkService.approveIntake(approving.id, {
        clientId: approveForm.clientId,
        companyId: approveForm.companyId || undefined,
        ownerCaId: approveForm.ownerCaId,
        engagementTitle: approveForm.engagementTitle || undefined,
        services: (approveForm.services || approving.services?.join(',') || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      })
    },
    onSuccess: () => {
      toast.success('Intake approved')
      setApproving(null)
      qc.invalidateQueries({ queryKey: ['work-intakes'] })
    },
    onError: (e: Error) => toast.error(e.message || 'Approve failed'),
  })

  const rejectMut = useMutation({
    mutationFn: () => {
      if (!rejecting) throw new Error('No intake selected')
      return WorkService.rejectIntake(rejecting.id, { remarks: rejectRemarks })
    },
    onSuccess: () => {
      toast.success('Intake rejected')
      setRejecting(null)
      setRejectRemarks('')
      qc.invalidateQueries({ queryKey: ['work-intakes'] })
    },
    onError: (e: Error) => toast.error(e.message || 'Reject failed'),
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Intake Desk"
        description="Reception creates tickets · Manager approves → Client / Company / Engagement"
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/work"><Button variant="secondary">All Work</Button></Link>
            <Can permission="intake.create">
              <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New Intake</Button>
            </Can>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2">
        {['', 'INTAKE', 'APPROVED', 'REJECTED'].map((s) => (
          <button
            key={s || 'all'}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm',
              statusFilter === s
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300',
            )}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-sm text-gray-500">Loading intakes…</p>}
      {isError && <p className="text-sm text-red-600">{(error as Error)?.message || 'Failed to load intakes'}</p>}
      {!isLoading && !isError && intakes.length === 0 && (
        <p className="text-sm text-gray-500">No intakes in this queue.</p>
      )}

      <div className="space-y-3">
        {intakes.map((item) => (
          <div
            key={item.id}
            className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{item.contactName}</h3>
                  <span className={cn('px-2 py-0.5 rounded-md text-xs font-medium', intakeStatusClass(item.status))}>
                    {item.status}
                  </span>
                  <Badge>{item.source}</Badge>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {[item.contactPhone, item.contactEmail].filter(Boolean).join(' · ') || 'No contact details'}
                  {' · '}
                  {item.createdAt ? formatDate(item.createdAt) : ''}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
                  Services: {(item.services || []).join(', ') || '—'}
                </p>
                {item.notes && <p className="text-sm text-gray-500 mt-1">{item.notes}</p>}
                {item.rejectRemarks && (
                  <p className="text-sm text-red-600 mt-1">Reject: {item.rejectRemarks}</p>
                )}
                {(item.clientId || item.engagementId) && (
                  <p className="text-xs text-gray-400 mt-2">
                    Client {item.clientId || '—'} · Co {item.companyId || '—'} · Eng {item.engagementId || '—'} · CA {item.ownerCaId || '—'}
                  </p>
                )}
              </div>
              {(item.status || '').toUpperCase() === 'INTAKE' && (
                <div className="flex gap-2">
                  <Can permission="intake.approve">
                    <Button
                      onClick={() => {
                        setApproving(item)
                        setApproveForm({
                          clientId: item.clientId || '',
                          companyId: item.companyId || '',
                          ownerCaId: item.ownerCaId || '',
                          engagementTitle: '',
                          services: (item.services || []).join(', '),
                        })
                      }}
                    >
                      Approve
                    </Button>
                  </Can>
                  <Can permission="intake.reject">
                    <Button variant="secondary" onClick={() => { setRejecting(item); setRejectRemarks('') }}>
                      Reject
                    </Button>
                  </Can>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-gray-900 p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">New intake</h3>
            <input
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm"
              placeholder="Contact name *"
              value={form.contactName}
              onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
            />
            <input
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm"
              placeholder="Phone"
              value={form.contactPhone}
              onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))}
            />
            <input
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm"
              placeholder="Email"
              value={form.contactEmail}
              onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))}
            />
            <select
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm"
              value={form.source}
              onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
            >
              {SOURCES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
            <input
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm"
              placeholder="Services (comma-separated)"
              value={form.services}
              onChange={(e) => setForm((f) => ({ ...f, services: e.target.value }))}
            />
            <textarea
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm"
              rows={3}
              placeholder="Notes"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setCreating(false)}>Cancel</Button>
              <Button disabled={!form.contactName.trim() || createMut.isPending} onClick={() => createMut.mutate()}>
                Create
              </Button>
            </div>
          </div>
        </div>
      )}

      {approving && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-gray-900 p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Approve intake</h3>
            <p className="text-sm text-gray-500">{approving.contactName}</p>
            {(['clientId', 'companyId', 'ownerCaId', 'engagementTitle', 'services'] as const).map((k) => (
              <input
                key={k}
                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm"
                placeholder={k === 'clientId' || k === 'ownerCaId' ? `${k} *` : k}
                value={approveForm[k]}
                onChange={(e) => setApproveForm((f) => ({ ...f, [k]: e.target.value }))}
              />
            ))}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setApproving(null)}>Cancel</Button>
              <Button
                disabled={!approveForm.clientId || !approveForm.ownerCaId || approveMut.isPending}
                onClick={() => approveMut.mutate()}
              >
                Approve
              </Button>
            </div>
          </div>
        </div>
      )}

      {rejecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Reject intake</h3>
            <p className="text-sm text-gray-500">{rejecting.contactName}</p>
            <textarea
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm"
              rows={3}
              placeholder="Remarks (required)"
              value={rejectRemarks}
              onChange={(e) => setRejectRemarks(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setRejecting(null)}>Cancel</Button>
              <Button disabled={!rejectRemarks.trim() || rejectMut.isPending} onClick={() => rejectMut.mutate()}>
                Reject
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
