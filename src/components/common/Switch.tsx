import { Switch as HeadlessSwitch } from '@headlessui/react'
import { cn } from '@/utils'

export interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  /** Accessible name when no visible label is associated */
  'aria-label'?: string
  id?: string
  className?: string
  size?: 'sm' | 'md'
}

/**
 * Track / thumb geometry (md):
 * - track: 44×24 (w-11 h-6)
 * - padding: 2px (p-0.5)
 * - thumb: 20×20 (h-5 w-5)
 * - travel = 44 - 20 - 2×2 = 20px = 1.25rem = translate-x-5
 *
 * Thumb is absolutely positioned from left-0.5 so OFF/ON travel is stable.
 */
const sizeStyles = {
  sm: {
    track: 'h-5 w-9',
    thumb: 'h-4 w-4 top-0.5 left-0.5',
    on: 'translate-x-4', // 36 - 16 - 4 = 16px
  },
  md: {
    track: 'h-6 w-11',
    thumb: 'h-5 w-5 top-0.5 left-0.5',
    on: 'translate-x-5', // 44 - 20 - 4 = 20px
  },
} as const

export function Switch({
  checked,
  onChange,
  disabled = false,
  id,
  className,
  size = 'md',
  'aria-label': ariaLabel,
}: SwitchProps) {
  const s = sizeStyles[size]

  return (
    <HeadlessSwitch
      checked={checked}
      onChange={onChange}
      disabled={disabled}
      id={id}
      aria-label={ariaLabel}
      className={cn(
        'relative inline-flex shrink-0 rounded-full',
        'transition-colors duration-200 ease-out',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900',
        'motion-reduce:transition-none',
        // Expand hit target without changing visible track size
        "before:absolute before:content-[''] before:-inset-y-1 before:-inset-x-0.5",
        s.track,
        checked
          ? 'bg-primary-600 dark:bg-primary-500'
          : 'bg-gray-200 dark:bg-gray-700',
        disabled
          ? 'opacity-50 cursor-not-allowed'
          : 'cursor-pointer',
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute rounded-full bg-white shadow-sm ring-0',
          'transition-transform duration-200 ease-out motion-reduce:transition-none',
          s.thumb,
          checked ? s.on : 'translate-x-0',
        )}
      />
    </HeadlessSwitch>
  )
}

export interface SwitchFieldProps extends SwitchProps {
  label: string
  description?: string
}

/** Labeled settings-style switch row */
export function SwitchField({
  label,
  description,
  checked,
  onChange,
  disabled,
  className,
  ...switchProps
}: SwitchFieldProps) {
  const id = switchProps.id || `switch-${label.replace(/\s+/g, '-').toLowerCase()}`

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 p-4 rounded-xl border border-gray-100 dark:border-gray-800',
        disabled && 'opacity-70',
        className,
      )}
    >
      <div className="min-w-0">
        <label htmlFor={id} className="block text-sm font-medium text-gray-900 dark:text-gray-100 cursor-pointer">
          {label}
        </label>
        {description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
        )}
      </div>
      <Switch
        {...switchProps}
        id={id}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        aria-label={label}
      />
    </div>
  )
}
