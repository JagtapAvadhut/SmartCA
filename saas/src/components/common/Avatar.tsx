import { cn } from '@/utils'
import { getInitials } from '@/utils/format'

interface AvatarProps {
  src?: string
  name: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizes = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
}

const colors = [
  'bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
  'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300',
  'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300',
]

export function Avatar({ src, name, size = 'md', className }: AvatarProps) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={cn('rounded-full object-cover ring-2 ring-white dark:ring-gray-900', sizes[size], className)}
      />
    )
  }

  const colorIndex = name.charCodeAt(0) % colors.length

  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center font-semibold ring-2 ring-white dark:ring-gray-900',
        sizes[size],
        colors[colorIndex],
        className
      )}
      aria-label={name}
    >
      {getInitials(name)}
    </div>
  )
}
