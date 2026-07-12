import { forwardRef, useId, type InputHTMLAttributes } from 'react'
import { cn } from '@/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  icon?: React.ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, icon, id, name, required, ...props }, ref) => {
    const autoId = useId()
    const inputId = id || (name ? `field-${String(name)}` : autoId)
    const errorId = `${inputId}-error`

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            {label}
            {required ? <span className="text-red-500 ml-0.5" aria-hidden>*</span> : null}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden>{icon}</div>
          )}
          <input
            ref={ref}
            id={inputId}
            name={name}
            required={required}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className={cn(
              'w-full h-10 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm text-gray-900 dark:text-gray-100',
              'placeholder:text-gray-400 dark:placeholder:text-gray-500 transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500',
              icon && 'pl-10',
              error && 'border-red-300 focus:ring-red-500/20 focus:border-red-500',
              className
            )}
            {...props}
          />
        </div>
        {error && <p id={errorId} className="mt-1 text-xs text-red-500" role="alert">{error}</p>}
      </div>
    )
  }
)
Input.displayName = 'Input'
