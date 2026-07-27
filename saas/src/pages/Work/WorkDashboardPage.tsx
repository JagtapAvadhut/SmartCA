import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { PageHeader, Button } from '@/components/common'
import { WorkService } from '@/services/workService'
import { useAuthStore } from '@/store'

function isManagerLike(role?: string) {
  return ['super_admin', 'admin', 'partner', 'manager', 'ca', 'senior_ca'].includes(role || '')
}

export default function WorkDashboardPage() {
  const role = useAuthStore((s) => s.user?.role)
  const { data, isLoading } = useQuery({
    queryKey: ['work-dashboard'],
    queryFn: () => WorkService.dashboard(),
  })

  const cards = [
    { label: 'Pending', value: data?.pending },
    { label: 'Completed', value: data?.completed },
    { label: 'Ready for TL Verify', value: data?.readyForTLVerify },
    { label: 'Ready for CA Verify', value: data?.readyForCAVerify },
    { label: 'Awaiting Close', value: data?.readyForManagerClose ?? data?.awaitingClose },
    { label: 'Overdue', value: data?.overdue },
    { label: "Today's Work", value: data?.todaysWork },
    { label: 'My Work', value: data?.myWork },
    { label: "Today's Follow-ups", value: data?.todaysFollowUps },
    { label: 'Upcoming Calls', value: data?.upcomingCalls },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title={isManagerLike(role) ? 'Manager Work Dashboard' : 'My Work Dashboard'}
        description="Live practice workload and performance"
        actions={<Link to="/work"><Button variant="secondary">Back to Work</Button></Link>}
      />
      {isLoading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {cards.map((c) => (
            <div key={c.label} className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
              <p className="text-xs uppercase tracking-wide text-gray-400">{c.label}</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white mt-1">{c.value ?? 0}</p>
            </div>
          ))}
        </div>
      )}
      {isManagerLike(role) && data?.departmentSummary && (
        <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
          <h3 className="font-semibold mb-3 text-gray-900 dark:text-white">Department Summary</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(data.departmentSummary).map(([k, v]) => (
              <span key={k} className="px-3 py-1 rounded-full bg-primary-50 dark:bg-primary-900/30 text-sm text-primary-700 dark:text-primary-300">
                {k || 'Unassigned'}: {v}
              </span>
            ))}
          </div>
        </div>
      )}
      {isManagerLike(role) && data?.employeePerformance && (
        <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
          <h3 className="font-semibold mb-3 text-gray-900 dark:text-white">Employee Performance (work count)</h3>
          <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
            {Object.entries(data.employeePerformance).map(([k, v]) => (
              <li key={k} className="flex justify-between border-b border-gray-50 dark:border-gray-800 py-1">
                <span>{k}</span><span>{v}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
