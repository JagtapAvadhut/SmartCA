import { motion } from 'framer-motion'
import { cn } from '@/utils'

interface CardProps {
  children: React.ReactNode
  className?: string
  hover?: boolean
  padding?: boolean
  onClick?: () => void
}

export function Card({ children, className, hover = false, padding = true, onClick }: CardProps) {
  const Component = onClick ? motion.button : motion.div
  return (
    <Component
      type={onClick ? 'button' : undefined}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={hover ? { y: -2, boxShadow: '0 8px 30px rgba(0,0,0,0.08)' } : undefined}
      onClick={onClick}
      className={cn(
        'bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm text-left w-full',
        padding && 'p-6',
        hover && 'cursor-pointer transition-shadow',
        className
      )}
    >
      {children}
    </Component>
  )
}

export function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('flex items-center justify-between mb-4', className)}>{children}</div>
}

export function CardTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h3 className={cn('text-base font-semibold text-gray-900 dark:text-gray-100', className)}>{children}</h3>
}
