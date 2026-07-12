import { Modal } from './Modal'
import { Button } from './Button'
import { AlertTriangle, Archive } from 'lucide-react'

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  onArchive?: () => void
  title?: string
  message?: string
  warnings?: string[]
  confirmLabel?: string
  archiveLabel?: string
  loading?: boolean
  danger?: boolean
  preferArchive?: boolean
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  onArchive,
  title = 'Confirm',
  message = 'Are you sure you want to continue?',
  warnings = [],
  confirmLabel = 'Delete permanently',
  archiveLabel = 'Archive instead',
  loading,
  danger = true,
  preferArchive = false,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-xl shrink-0 ${danger ? 'bg-red-50 dark:bg-red-900/20' : 'bg-primary-50 dark:bg-primary-900/20'}`}>
            <AlertTriangle className={`h-5 w-5 ${danger ? 'text-red-500' : 'text-primary-600'}`} />
          </div>
          <div className="min-w-0">
            <p className="text-sm text-gray-600 dark:text-gray-300">{message}</p>
            {warnings.length > 0 && (
              <ul className="mt-3 space-y-1 text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3">
                {warnings.map((w) => (
                  <li key={w}>• {w}</li>
                ))}
              </ul>
            )}
            {preferArchive && (
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Archiving keeps related invoices, payments, and documents intact.
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading} className="w-full sm:w-auto">
            Cancel
          </Button>
          {onArchive && (
            <Button variant="secondary" onClick={onArchive} disabled={loading} className="w-full sm:w-auto">
              <Archive className="h-4 w-4" /> {archiveLabel}
            </Button>
          )}
          <Button
            variant={danger ? 'danger' : 'primary'}
            onClick={onConfirm}
            loading={loading}
            className="w-full sm:w-auto"
            disabled={preferArchive && !onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
