import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { PageHeader, Button } from '@/components/common'
import { WorkService } from '@/services/workService'

export default function WorkTimelinePage() {
  const { data, isLoading } = useQuery({
    queryKey: ['work-timeline'],
    queryFn: () => WorkService.timeline(150),
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Work Timeline"
        description="Organization activity stream"
        actions={<Link to="/work"><Button variant="secondary">Back</Button></Link>}
      />
      {isLoading ? <p className="text-sm text-gray-500">Loading…</p> : (
        <ol className="relative border-l border-gray-200 dark:border-gray-700 ml-3 space-y-4">
          {(data || []).map((ev) => (
            <li key={String(ev.id)} className="ml-4">
              <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-primary-500" />
              <p className="text-sm font-medium text-gray-900 dark:text-white">{String(ev.summary || ev.action)}</p>
              <p className="text-xs text-gray-400">
                {String(ev.actorName || ev.actorId)} · {String(ev.action)} · {String(ev.createdAt || '')}
              </p>
            </li>
          ))}
          {(data || []).length === 0 && <p className="text-sm text-gray-500 ml-4">No activity yet.</p>}
        </ol>
      )}
    </div>
  )
}
