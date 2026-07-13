import { Pencil, Trash2, Copy, Archive } from 'lucide-react'
import { Button } from './Button'
import { Can } from './Can'
import type { Permission } from '@/types/auth'

interface RowActionsProps {
  onEdit?: () => void
  onDelete?: () => void
  onDuplicate?: () => void
  onArchive?: () => void
  editPermission?: Permission
  deletePermission?: Permission
}

export function RowActions({
  onEdit,
  onDelete,
  onDuplicate,
  onArchive,
  editPermission,
  deletePermission,
}: RowActionsProps) {
  return (
    <div className="flex items-center gap-1">
      {onEdit && (
        <Can permission={editPermission}>
          <Button variant="ghost" size="sm" onClick={onEdit} title="Edit" aria-label="Edit">
            <Pencil className="h-4 w-4" />
          </Button>
        </Can>
      )}
      {onDuplicate && (
        <Button variant="ghost" size="sm" onClick={onDuplicate} title="Duplicate" aria-label="Duplicate">
          <Copy className="h-4 w-4" />
        </Button>
      )}
      {onArchive && (
        <Button variant="ghost" size="sm" onClick={onArchive} title="Archive" aria-label="Archive">
          <Archive className="h-4 w-4" />
        </Button>
      )}
      {onDelete && (
        <Can permission={deletePermission}>
          <Button variant="ghost" size="sm" onClick={onDelete} title="Delete" aria-label="Delete" className="text-red-500 hover:text-red-600">
            <Trash2 className="h-4 w-4" />
          </Button>
        </Can>
      )}
    </div>
  )
}
