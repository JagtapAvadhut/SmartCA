import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { PageHeader, Button } from '@/components/common'
import {
  WorkService,
  PRACTICE_BOARD_COLUMNS,
  toPracticeStatus,
  type WorkItem,
  type PracticeStatus,
} from '@/services/workService'
import { cn } from '@/utils'
import { formatPracticeStatus, overlayBadgeClass, riskBadgeClass } from '@/utils/practiceStatus'

export default function WorkBoardPage() {
  const navigate = useNavigate()
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['work-board'],
    queryFn: () => WorkService.list({ page: 1, pageSize: 500 }),
  })

  const byStatus = useMemo(() => {
    const map: Record<string, WorkItem[]> = {}
    for (const s of PRACTICE_BOARD_COLUMNS) map[s] = []
    map.OTHER = []
    for (const item of data?.items || []) {
      const key = toPracticeStatus(item.status)
      if (PRACTICE_BOARD_COLUMNS.includes(key)) map[key].push(item)
      else map.OTHER.push(item)
    }
    return map
  }, [data])

  const columns: Array<PracticeStatus | 'OTHER'> = [
    ...PRACTICE_BOARD_COLUMNS,
    ...(byStatus.OTHER?.length ? (['OTHER'] as const) : []),
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Practice Board"
        description="Kanban by practice status · Client / Company · overlay · triad"
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/work"><Button variant="secondary">Table view</Button></Link>
            <Link to="/work/intake"><Button variant="secondary">Intake</Button></Link>
          </div>
        }
      />
      {isLoading && <p className="text-sm text-gray-500">Loading…</p>}
      {isError && <p className="text-sm text-red-600">{(error as Error)?.message || 'Failed to load board'}</p>}
      {!isLoading && !isError && (data?.items || []).length === 0 && (
        <p className="text-sm text-gray-500">No work items in scope.</p>
      )}
      {!isLoading && !isError && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map((status) => (
            <div
              key={status}
              className="min-w-[240px] w-[240px] sm:min-w-[260px] sm:w-[260px] rounded-2xl bg-gray-50 dark:bg-gray-900/60 border border-gray-100 dark:border-gray-800 p-3"
            >
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
                {status === 'OTHER' ? 'Other' : formatPracticeStatus(status)} ({byStatus[status]?.length || 0})
              </h3>
              <div className="space-y-2">
                {(byStatus[status] || []).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigate(`/work/${item.id}`)}
                    className={cn(
                      'w-full text-left rounded-xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-3 shadow-sm hover:border-primary-300 transition-colors',
                    )}
                  >
                    <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2">{item.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                      {item.clientName || 'No client'}
                      {item.companyId ? ` · ${item.companyId.slice(0, 8)}…` : ''}
                    </p>
                    {item.periodKey && (
                      <p className="text-[10px] text-gray-400 mt-1">{item.periodKey}{item.workType ? ` · ${item.workType}` : ''}</p>
                    )}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {item.overlay && (
                        <span className={overlayBadgeClass()}>{item.overlay.replace(/_/g, ' ')}</span>
                      )}
                      {item.riskClass && (
                        <span className={cn('px-1.5 py-0.5 rounded text-[10px] capitalize', riskBadgeClass(item.riskClass))}>
                          {item.riskClass}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-2 truncate">
                      {item.assignedToName || item.assigneeId || item.assignedTo || 'Unassigned'}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
