import { ROUTE_PERMISSIONS, type Permission, type UserRole } from '@/types/auth'
import { useAuthStore } from '@/store'

/** Aligns with Go workmgmt.PermissionsForRole (Practice Core v1). */
function hierarchyWorkPermissions(role: string | undefined): Permission[] {
  const r = (role || '').toLowerCase().replace(/-/g, '_')

  if (r === 'partner') {
    return [
      'work.view', 'work.create', 'work.edit', 'work.delete', 'work.assign',
      'work.transition', 'work.verify.tl', 'work.verify.ca',
      'work.close.manager', 'work.close.partner', 'work.reopen',
      'work.comment', 'work.upload', 'work.users.create', 'work.audit.view',
      'work.dashboard.manage', 'work.dashboard.mine',
      'intake.create', 'intake.approve', 'intake.reject',
      'engagement.create', 'engagement.edit', 'hierarchy.place',
    ]
  }

  // Manager: Practice Core grants minus SoD (no TL/CA verify, no partner-close).
  if (r === 'manager' || r === 'super_admin') {
    return [
      'work.view', 'work.create', 'work.edit', 'work.delete', 'work.assign',
      'work.transition', 'work.close.manager', 'work.reopen',
      'work.comment', 'work.upload', 'work.users.create', 'work.audit.view',
      'work.dashboard.manage', 'work.dashboard.mine',
      'intake.create', 'intake.approve', 'intake.reject',
      'engagement.create', 'engagement.edit', 'hierarchy.place',
    ]
  }

  if (r === 'ca' || r === 'senior_ca') {
    return [
      'work.view', 'work.create', 'work.edit', 'work.delete', 'work.assign',
      'work.transition', 'work.verify.ca',
      'work.comment', 'work.upload', 'work.users.create', 'work.audit.view',
      'work.dashboard.manage', 'work.dashboard.mine',
      'engagement.create', 'engagement.edit', 'intake.create',
    ]
  }

  if (r === 'team_leader') {
    return [
      'work.view', 'work.create', 'work.edit', 'work.assign',
      'work.transition', 'work.verify.tl',
      'work.comment', 'work.upload', 'work.users.create', 'work.dashboard.mine',
    ]
  }

  if (r === 'junior_ca' || r === 'accountant' || r === 'article_assistant' || r === 'employee') {
    return [
      'work.view', 'work.edit', 'work.transition',
      'work.comment', 'work.upload', 'work.dashboard.mine',
    ]
  }

  if (r === 'reception' || r === 'receptionist') {
    return [
      'work.view', 'intake.create', 'work.comment', 'work.upload', 'work.dashboard.mine',
    ]
  }

  if (r === 'hr') {
    return ['employees.create', 'work.users.create', 'work.dashboard.mine']
  }

  if (r === 'admin') {
    return ['work.view', 'work.audit.view', 'work.dashboard.mine']
  }

  return ['work.view', 'work.comment', 'work.dashboard.mine']
}

export function effectivePermissions(
  userPermissions: Permission[] | undefined,
  role?: UserRole | string,
): Permission[] {
  const base = userPermissions ?? []
  const derived = hierarchyWorkPermissions(role)
  return Array.from(new Set([...base, ...derived])) as Permission[]
}

export function hasPermission(
  userPermissions: Permission[] | undefined,
  permission: Permission
): boolean {
  const role = useAuthStore.getState().user?.role
  const perms = effectivePermissions(userPermissions, role)
  return perms.includes(permission)
}

export function hasAnyPermission(
  userPermissions: Permission[] | undefined,
  permissions: Permission[]
): boolean {
  return permissions.some((p) => hasPermission(userPermissions, p))
}

export function hasAllPermissions(
  userPermissions: Permission[] | undefined,
  permissions: Permission[]
): boolean {
  return permissions.every((p) => hasPermission(userPermissions, p))
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
