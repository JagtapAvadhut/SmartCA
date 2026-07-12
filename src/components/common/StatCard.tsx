import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Minus, type LucideIcon } from 'lucide-react'
import { cn, formatCurrency, formatNumber } from '@/utils'
import type { KPI } from '@/types'

interface StatCardProps {
  title: string
  kpi: KPI
  icon: LucideIcon
  format?: 'currency' | 'number'
  color?: string
  delay?: number
}

export function StatCard({ title, kpi, icon: Icon, format = 'number', color = 'bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400', delay = 0 }: StatCardProps) {
  const displayValue = format === 'currency' ? formatCurrency(kpi.value) : formatNumber(kpi.value)
  const TrendIcon = kpi.trend === 'up' ? TrendingUp : kpi.trend === 'down' ? TrendingDown : Minus

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between">
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">{displayValue}</p>
          <div className="flex items-center gap-1.5">
            <TrendIcon className={cn('h-3.5 w-3.5', kpi.trend === 'up' ? 'text-emerald-500' : kpi.trend === 'down' ? 'text-red-500' : 'text-gray-400')} />
            <span className={cn('text-xs font-medium', kpi.trend === 'up' ? 'text-emerald-600' : kpi.trend === 'down' ? 'text-red-600' : 'text-gray-500')}>
              {kpi.change > 0 ? '+' : ''}{kpi.change}%
            </span>
            <span className="text-xs text-gray-400">vs last month</span>
          </div>
        </div>
        <div className={cn('p-3 rounded-xl', color)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </motion.div>
  )
}
