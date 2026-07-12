import { ROUTE_PERMISSIONS, type Permission, type UserRole } from '@/types/auth'

export function hasPermission(
  userPermissions: Permission[] | undefined,
  permission: Permission
): boolean {
  if (!userPermissions) return false
  return userPermissions.includes(permission)
}

export function hasAnyPermission(
  userPermissions: Permission[] | undefined,
  permissions: Permission[]
): boolean {
  if (!userPermissions) return false
  return permissions.some((p) => userPermissions.includes(p))
}

export function hasAllPermissions(
  userPermissions: Permission[] | undefined,
  permissions: Permission[]
): boolean {
  if (!userPermissions) return false
  return permissions.every((p) => userPermissions.includes(p))
}

export function hasRole(userRole: UserRole | undefined, roles: UserRole[]): boolean {
  if (!userRole) return false
  return roles.includes(userRole)
}

export function canAccessRoute(
  userPermissions: Permission[] | undefined,
  path: string
): boolean {
  if (ROUTE_PERMISSIONS[path]) {
    return hasPermission(userPermissions, ROUTE_PERMISSIONS[path])
  }
  const sorted = Object.entries(ROUTE_PERMISSIONS).sort((a, b) => b[0].length - a[0].length)
  for (const [route, perm] of sorted) {
    if (route !== '/' && path.startsWith(route)) {
      return hasPermission(userPermissions, perm)
    }
  }
  return true
}

export function filterNavByPermissions<T extends { permission?: string; children?: T[] }>(
  items: T[],
  userPermissions: Permission[] | undefined
): T[] {
  return items
    .filter((item) => !item.permission || hasPermission(userPermissions, item.permission as Permission))
    .map((item) => ({
      ...item,
      children: item.children ? filterNavByPermissions(item.children, userPermissions) : undefined,
    }))
    .filter((item) => !item.children || item.children.length > 0)
}
