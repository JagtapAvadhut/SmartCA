import type { Permission } from '@/types/auth'
import { usePermission } from '@/hooks/useAuth'

interface CanProps {
  permission?: Permission
  permissions?: Permission[]
  requireAll?: boolean
  fallback?: React.ReactNode
  children: React.ReactNode
}

export function Can({ permission, permissions, requireAll = false, fallback = null, children }: CanProps) {
  const { can, canAny, canAll } = usePermission()

  let allowed = true
  if (permission) allowed = can(permission)
  else if (permissions) allowed = requireAll ? canAll(permissions) : canAny(permissions)

  return allowed ? <>{children}</> : <>{fallback}</>
}
