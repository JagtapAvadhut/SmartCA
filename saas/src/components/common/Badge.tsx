import { cn } from '@/utils'
import { STATUS_COLORS, PRIORITY_COLORS, BADGE_FALLBACK } from '@/constants/status'
import { capitalize } from '@/utils/format'

interface BadgeProps {
  status?: string
  priority?: string
  children?: React.ReactNode
  className?: string
  variant?: 'status' | 'priority' | 'default'
}

export function Badge({ status, priority, children, className, variant = 'status' }: BadgeProps) {
  const label = children || capitalize(status || priority || '')
  const colorClass =
    variant === 'priority' && priority
      ? PRIORITY_COLORS[priority] || BADGE_FALLBACK
      : status
        ? STATUS_COLORS[status] || BADGE_FALLBACK
        : BADGE_FALLBACK

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        colorClass,
        className
      )}
    >
      {label}
    </span>
  )
}
