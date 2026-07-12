/** Semantic status/priority badge tokens — always include dark: pairs for contrast. */
export const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  inactive: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  prospect: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  draft: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  sent: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  partially_paid: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  overdue: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  cancelled: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  filed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  in_review: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  waiting_client: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  upcoming: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  todo: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  review: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
}

export const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  urgent: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
}

export const BADGE_FALLBACK =
  'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'

export const COMPLIANCE_COLUMNS = [
  { id: 'upcoming', title: 'Upcoming', color: 'border-gray-300 dark:border-gray-600' },
  { id: 'in_progress', title: 'In Progress', color: 'border-blue-400 dark:border-blue-500' },
  { id: 'waiting_client', title: 'Waiting Client', color: 'border-orange-400 dark:border-orange-500' },
  { id: 'completed', title: 'Completed', color: 'border-emerald-400 dark:border-emerald-500' },
] as const
