import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { PageHeader, Button, Badge, Can } from '@/components/common'
import {
  WorkService,
  toPracticeStatus,
  type ChecklistItem,
  type PracticeStatus,
} from '@/services/workService'
import { formatPracticeStatus, overlayBadgeClass, practiceStatusClass, riskBadgeClass } from '@/utils/practiceStatus'
import { usePermission } from '@/hooks/useAuth'
import { cn } from '@/utils'

const TABS = [
  'overview', 'checklist', 'followups', 'calls', 'emails', 'meetings',
  'notes', 'comments', 'files', 'activity', 'audit',
] as const

const FREE_TRANSITIONS: PracticeStatus[] = [
  'DOCUMENT_PENDING', 'DOCUMENT_RECEIVED', 'IN_PROGRESS', 'BLOCKED', 'ON_HOLD',
]

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-gray-400">{label}</p>
      <p className="text-sm text-gray-800 dark:text-gray-100 break-all">{value}</p>
    </div>
  )
}

export default function WorkDetailPage() {
  const { id = '' } = useParams()
  const qc = useQueryClient()
  const { can } = usePermission()
  const [tab, setTab] = useState<(typeof TABS)[number]>('overview')
  const [note, setNote] = useState('')
  const [comment, setComment] = useState('')
  const [remarks, setRemarks] = useState('')
  const [reopenReason, setReopenReason] = useState('')
  const [checklistForm, setChecklistForm] = useState({ code: '', label: '' })
  const [rejectCid, setRejectCid] = useState<string | null>(null)
  const [rejectRemarks, setRejectRemarks] = useState('')

  const { data: item, isLoading, isError, error } = useQuery({
    queryKey: ['work-item', id],
    queryFn: () => WorkService.get(id),
    enabled: !!id,
  })

  const { data: checklist = [], isLoading: checklistLoading } = useQuery({
    queryKey: ['work-checklist', id],
    queryFn: () => WorkService.listChecklist(id),
    enabled: !!id && tab === 'checklist',
  })

  const { data: engagements } = useQuery({
    queryKey: ['work-engagements', item?.clientId],
    queryFn: () => WorkService.listEngagements({ clientId: item?.clientId }),
    enabled: !!item?.clientId && !!item?.engagementId,
  })

  const engagement = useMemo(
    () => (engagements || []).find((e) => e.id === item?.engagementId),
    [engagements, item?.engagementId],
  )

  const { data: tabData } = useQuery({
    queryKey: ['work-tab', id, tab],
    enabled: !!id && tab !== 'overview' && tab !== 'checklist',
    queryFn: async () => {
      switch (tab) {
        case 'followups': return WorkService.followups(id)
        case 'calls': return WorkService.calls(id)
        case 'emails': return WorkService.emails(id)
        case 'meetings': return WorkService.meetings(id)
        case 'notes': return WorkService.notes(id)
        case 'comments': return WorkService.comments(id)
        case 'files': return WorkService.attachments(id)
        case 'activity': return WorkService.activity(id)
        case 'audit': return WorkService.audit(id)
        default: return []
      }
    },
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['work-item', id] })
    qc.invalidateQueries({ queryKey: ['work-items'] })
    qc.invalidateQueries({ queryKey: ['work-board'] })
    qc.invalidateQueries({ queryKey: ['work-checklist', id] })
  }

  const onErr = (e: Error) => toast.error(e.message || 'Action failed')

  const transitionMut = useMutation({
    mutationFn: (to: string) => WorkService.transition(id, { to, remarks: remarks || undefined }),
    onSuccess: () => { toast.success('Status updated'); setRemarks(''); invalidate() },
    onError: onErr,
  })
  const verifyTLMut = useMutation({
    mutationFn: (decision: 'pass' | 'fail') => WorkService.verifyTL(id, { decision, remarks: remarks || undefined }),
    onSuccess: (_, d) => { toast.success(d === 'pass' ? 'TL verified' : 'TL rejected'); setRemarks(''); invalidate() },
    onError: onErr,
  })
  const verifyCAMut = useMutation({
    mutationFn: (decision: 'pass' | 'fail') => WorkService.verifyCA(id, { decision, remarks: remarks || undefined }),
    onSuccess: (_, d) => { toast.success(d === 'pass' ? 'CA verified' : 'CA rejected'); setRemarks(''); invalidate() },
    onError: onErr,
  })
  const closeMut = useMutation({
    mutationFn: () => WorkService.close(id, { remarks: remarks || undefined }),
    onSuccess: () => { toast.success('Work closed'); setRemarks(''); invalidate() },
    onError: onErr,
  })
  const reopenMut = useMutation({
    mutationFn: () => WorkService.reopen(id, { reason: reopenReason }),
    onSuccess: () => { toast.success('Work reopened'); setReopenReason(''); invalidate() },
    onError: onErr,
  })
  const addChecklistMut = useMutation({
    mutationFn: () => WorkService.addChecklist(id, checklistForm),
    onSuccess: () => {
      toast.success('Checklist item added')
      setChecklistForm({ code: '', label: '' })
      qc.invalidateQueries({ queryKey: ['work-checklist', id] })
    },
    onError: onErr,
  })
  const verifyChecklistMut = useMutation({
    mutationFn: ({ cid, decision, rem }: { cid: string; decision: 'pass' | 'fail'; rem?: string }) =>
      WorkService.verifyChecklist(id, cid, { decision, remarks: rem }),
    onSuccess: () => {
      toast.success('Checklist updated')
      setRejectCid(null)
      setRejectRemarks('')
      qc.invalidateQueries({ queryKey: ['work-checklist', id] })
    },
    onError: onErr,
  })

  const addNote = useMutation({
    mutationFn: () => WorkService.addNote(id, { body: note, format: 'markdown' }),
    onSuccess: () => { toast.success('Note added'); setNote(''); qc.invalidateQueries({ queryKey: ['work-tab', id, 'notes'] }) },
    onError: onErr,
  })
  const addComment = useMutation({
    mutationFn: () => WorkService.addComment(id, { body: comment }),
    onSuccess: () => { toast.success('Comment added'); setComment(''); qc.invalidateQueries({ queryKey: ['work-tab', id, 'comments'] }) },
    onError: onErr,
  })

  const rows = useMemo(() => (Array.isArray(tabData) ? tabData : []), [tabData])
  const status = item ? toPracticeStatus(item.status) : 'OPEN'
  const busy = transitionMut.isPending || verifyTLMut.isPending || verifyCAMut.isPending || closeMut.isPending || reopenMut.isPending

  const canChecklistVerify = can('work.verify.tl') || can('work.verify.ca') || can('work.close.manager')

  if (isLoading) return <p className="text-sm text-gray-500 p-6">Loading…</p>
  if (isError) return <p className="text-sm text-red-600 p-6">{(error as Error)?.message || 'Failed to load work'}</p>
  if (!item) return <p className="text-sm text-gray-500 p-6">Work item not found.</p>

  return (
    <div className="space-y-6">
      <PageHeader
        title={item.title}
        description={[
          item.clientName || 'No client',
          item.workType,
          item.periodKey,
          item.department || 'General',
        ].filter(Boolean).join(' · ')}
        actions={
          <div className="flex gap-2">
            <Link to="/work"><Button variant="secondary">Back</Button></Link>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2">
        <span className={practiceStatusClass(item.status)}>{formatPracticeStatus(item.status)}</span>
        {item.overlay && <span className={overlayBadgeClass()}>{item.overlay.replace(/_/g, ' ')}</span>}
        <Badge>{item.priority}</Badge>
        {item.riskClass && (
          <span className={cn('px-2 py-0.5 rounded-md text-xs font-medium capitalize', riskBadgeClass(item.riskClass))}>
            Risk: {item.riskClass}
          </span>
        )}
        <Badge>{item.completionPct}%</Badge>
      </div>

      {/* Review gate actions */}
      <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Review gates</h3>
        <textarea
          className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent p-3 text-sm"
          rows={2}
          placeholder="Remarks (required on reject)…"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <Can permission="work.transition">
            {(status === 'IN_PROGRESS' || status === 'DOCUMENT_RECEIVED' || status === 'TL_REJECTED') && (
              <Button disabled={busy} onClick={() => transitionMut.mutate('READY_FOR_TL_VERIFY')}>
                Submit for review
              </Button>
            )}
            {FREE_TRANSITIONS.filter((t) => t !== status).slice(0, 4).map((to) => (
              <Button key={to} variant="secondary" disabled={busy} onClick={() => transitionMut.mutate(to)}>
                → {formatPracticeStatus(to)}
              </Button>
            ))}
          </Can>

          <Can permission="work.verify.tl">
            {status === 'READY_FOR_TL_VERIFY' && (
              <>
                <Button disabled={busy} onClick={() => verifyTLMut.mutate('pass')}>TL Verify</Button>
                <Button variant="secondary" disabled={busy || !remarks.trim()} onClick={() => verifyTLMut.mutate('fail')}>
                  TL Reject
                </Button>
              </>
            )}
          </Can>

          <Can permission="work.verify.ca">
            {status === 'READY_FOR_CA_VERIFY' && (
              <>
                <Button disabled={busy} onClick={() => verifyCAMut.mutate('pass')}>CA Verify</Button>
                <Button variant="secondary" disabled={busy || !remarks.trim()} onClick={() => verifyCAMut.mutate('fail')}>
                  CA Reject
                </Button>
              </>
            )}
          </Can>

          <Can permissions={['work.close.manager', 'work.close.partner']}>
            {(status === 'READY_FOR_MANAGER_CLOSE' || status === 'DELIVERED') && (
              <Button disabled={busy} onClick={() => closeMut.mutate()}>Manager Close</Button>
            )}
          </Can>

          <Can permission="work.reopen">
            {status === 'CLOSED' && (
              <div className="flex flex-wrap gap-2 items-center w-full">
                <input
                  className="flex-1 min-w-[180px] rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm"
                  placeholder="Reopen reason (required)"
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                />
                <Button disabled={busy || !reopenReason.trim()} onClick={() => reopenMut.mutate()}>Reopen</Button>
              </div>
            )}
          </Can>
        </div>
      </div>

      {/* Client / Company / Engagement + ownership triad */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Client · Company · Engagement</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Client" value={item.clientName || item.clientId} />
            <Field label="Client ID" value={item.clientId} />
            <Field label="Company ID" value={item.companyId || '— (individual / not set)'} />
            <Field label="Engagement ID" value={item.engagementId} />
            <Field label="Engagement" value={engagement?.title || engagement?.fy} />
            <Field label="Services" value={engagement?.services?.join(', ')} />
            <Field label="Work type" value={item.workType} />
            <Field label="Period" value={item.periodKey} />
            <Field label="FY" value={item.fy} />
          </div>
        </div>
        <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Ownership triad</h3>
          <div className="grid gap-3 sm:grid-cols-1">
            <Field label="Owner CA" value={item.ownerCaId || '—'} />
            <Field label="Team Leader" value={item.tlId || '—'} />
            <Field label="Assignee" value={item.assignedToName || item.assigneeId || item.assignedTo || '—'} />
            <Field label="Assigned by" value={item.assignedByName || item.assignedBy} />
            {item.requiresPartnerSignoff && <Badge>Partner sign-off required</Badge>}
            {item.delegatedClose && <Badge>Delegated close</Badge>}
          </div>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm capitalize shrink-0',
              tab === t ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-3">
          <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap">{item.description || 'No description'}</p>
          <p className="text-xs text-gray-400">
            Est {item.estimatedHours}h · Actual {item.actualHours}h · Tags: {(item.tags || []).join(', ') || '—'}
          </p>
          {item.parentId && (
            <p className="text-xs">
              Parent: <Link className="text-primary-600" to={`/work/${item.parentId}`}>{item.parentId}</Link>
            </p>
          )}
        </div>
      )}

      {tab === 'checklist' && (
        <div className="space-y-4">
          <Can permission="work.edit">
            <div className="flex flex-wrap gap-2">
              <input
                className="rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm"
                placeholder="Code"
                value={checklistForm.code}
                onChange={(e) => setChecklistForm((f) => ({ ...f, code: e.target.value }))}
              />
              <input
                className="flex-1 min-w-[160px] rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm"
                placeholder="Label"
                value={checklistForm.label}
                onChange={(e) => setChecklistForm((f) => ({ ...f, label: e.target.value }))}
              />
              <Button
                disabled={!checklistForm.code || !checklistForm.label || addChecklistMut.isPending}
                onClick={() => addChecklistMut.mutate()}
              >
                Add item
              </Button>
            </div>
          </Can>

          {checklistLoading && <p className="text-sm text-gray-500">Loading checklist…</p>}
          {!checklistLoading && checklist.length === 0 && (
            <p className="text-sm text-gray-500">No checklist items yet.</p>
          )}

          <div className="space-y-2">
            {checklist.map((c: ChecklistItem) => (
              <div
                key={c.id}
                className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 space-y-2"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      <span className="text-gray-400 mr-2">{c.code}</span>
                      {c.label}
                    </p>
                    <p className="text-xs text-gray-400 capitalize mt-1">{c.status}{c.remarks ? ` · ${c.remarks}` : ''}</p>
                  </div>
                  {canChecklistVerify && c.status !== 'verified' && c.status !== 'rejected' && (
                    <div className="flex gap-2">
                      <Button
                        disabled={verifyChecklistMut.isPending}
                        onClick={() => verifyChecklistMut.mutate({ cid: c.id, decision: 'pass' })}
                      >
                        Verify
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={verifyChecklistMut.isPending}
                        onClick={() => setRejectCid(c.id)}
                      >
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
                {rejectCid === c.id && (
                  <div className="flex flex-wrap gap-2">
                    <input
                      className="flex-1 min-w-[160px] rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm"
                      placeholder="Reject remarks (required)"
                      value={rejectRemarks}
                      onChange={(e) => setRejectRemarks(e.target.value)}
                    />
                    <Button
                      disabled={!rejectRemarks.trim() || verifyChecklistMut.isPending}
                      onClick={() => verifyChecklistMut.mutate({ cid: c.id, decision: 'fail', rem: rejectRemarks })}
                    >
                      Confirm reject
                    </Button>
                    <Button variant="secondary" onClick={() => { setRejectCid(null); setRejectRemarks('') }}>Cancel</Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'notes' && (
        <div className="space-y-3">
          <textarea className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent p-3 text-sm" rows={4} placeholder="Markdown note…" value={note} onChange={(e) => setNote(e.target.value)} />
          <Button disabled={!note.trim() || addNote.isPending} onClick={() => addNote.mutate()}>Add note</Button>
        </div>
      )}
      {tab === 'comments' && (
        <div className="space-y-3">
          <textarea className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent p-3 text-sm" rows={3} placeholder="Internal comment…" value={comment} onChange={(e) => setComment(e.target.value)} />
          <Button disabled={!comment.trim() || addComment.isPending} onClick={() => addComment.mutate()}>Add comment</Button>
        </div>
      )}

      {tab !== 'overview' && tab !== 'checklist' && (
        <div className="space-y-2">
          {rows.length === 0 && <p className="text-sm text-gray-500">No entries yet.</p>}
          {rows.map((row) => (
            <pre key={String(row.id || JSON.stringify(row))} className="text-xs rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-3 overflow-auto">
              {JSON.stringify(row, null, 2)}
            </pre>
          ))}
        </div>
      )}
    </div>
  )
}
