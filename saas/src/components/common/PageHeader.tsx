import { motion } from 'framer-motion'
import { cn } from '@/utils'

interface PageHeaderProps {
  title: string
  description?: string
  actions?: React.ReactNode
  breadcrumbs?: { label: string; href?: string }[]
}

export function PageHeader({ title, description, actions, breadcrumbs }: PageHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8"
    >
      <div>
        {breadcrumbs && (
          <nav className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 mb-2">
            {breadcrumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <span>/</span>}
                <span className={cn(i === breadcrumbs.length - 1 && 'text-gray-900 dark:text-gray-100 font-medium')}>
                  {crumb.label}
                </span>
              </span>
            ))}
          </nav>
        )}
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">{title}</h1>
        {description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </motion.div>
  )
}
