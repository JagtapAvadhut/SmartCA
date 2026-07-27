import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { PageHeader, Button } from '@/components/common'
import { WorkService } from '@/services/workService'
import { formatDate } from '@/utils'

export default function WorkCalendarPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['work-calendar'],
    queryFn: () => WorkService.list({ page: 1, pageSize: 500, sort: 'dueDate' }),
  })

  const withDue = (data?.items || []).filter((i) => i.dueDate).sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Work Calendar"
        description="Due dates, follow-ups and scheduled work"
        actions={<Link to="/work"><Button variant="secondary">Back</Button></Link>}
      />
      {isLoading ? <p className="text-sm text-gray-500">Loading…</p> : (
        <div className="space-y-2">
          {withDue.length === 0 && <p className="text-sm text-gray-500">No dated work items yet.</p>}
          {withDue.map((item) => (
            <Link
              key={item.id}
              to={`/work/${item.id}`}
              className="flex items-center justify-between rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3 hover:border-primary-300"
            >
              <div>
                <p className="font-medium text-gray-900 dark:text-white">{item.title}</p>
                <p className="text-xs text-gray-400">{item.clientName || item.department}</p>
              </div>
              <div className="text-right text-sm">
                <p className="text-gray-700 dark:text-gray-200">{formatDate(String(item.dueDate))}</p>
                <p className="text-xs capitalize text-gray-400">{item.status.replace(/_/g, ' ')}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
