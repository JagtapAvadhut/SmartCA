import { FileQuestion, Plus } from 'lucide-react'
import { Button } from './Button'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="h-16 w-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
        {icon || <FileQuestion className="h-8 w-8 text-gray-400" />}
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mb-6">{description}</p>
      )}
      {action && (
        <Button onClick={action.onClick}>
          <Plus className="h-4 w-4" /> {action.label}
        </Button>
      )}
    </div>
  )
}
