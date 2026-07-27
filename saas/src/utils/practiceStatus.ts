import { cn } from '@/utils'
import type { PracticeStatus, WorkStatus } from '@/services/workService'
import { toPracticeStatus } from '@/services/workService'

export function formatPracticeStatus(status: string | undefined): string {
  return toPracticeStatus(status).replace(/_/g, ' ')
}

export function practiceStatusClass(status: string | undefined): string {
  const s = toPracticeStatus(status)
  const map: Record<PracticeStatus, string> = {
    OPEN: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    DOCUMENT_PENDING: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200',
    DOCUMENT_RECEIVED: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200',
    IN_PROGRESS: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    BLOCKED: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    ON_HOLD: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    READY_FOR_TL_VERIFY: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
    TL_REJECTED: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200',
    TL_VERIFIED: 'bg-lime-100 text-lime-800 dark:bg-lime-900/40 dark:text-lime-200',
    READY_FOR_CA_VERIFY: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200',
    CA_REJECTED: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200',
    CA_VERIFIED: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200',
    READY_FOR_MANAGER_CLOSE: 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/40 dark:text-fuchsia-200',
    DELIVERED: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-200',
    CLOSED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    CANCELLED: 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
  }
  return cn('px-2 py-0.5 rounded-md text-xs font-medium', map[s] || map.OPEN)
}

export function overlayBadgeClass(): string {
  return 'px-2 py-0.5 rounded-md text-xs font-medium bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-200'
}

export function riskBadgeClass(risk: string | undefined): string {
  const r = (risk || 'medium').toLowerCase()
  if (r === 'high') return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
  if (r === 'low') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
  return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
}

export function isClosedLike(status: WorkStatus | string | undefined): boolean {
  const s = toPracticeStatus(status)
  return s === 'CLOSED' || s === 'DELIVERED' || s === 'CANCELLED'
}
