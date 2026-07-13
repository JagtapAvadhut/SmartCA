import { useAuthStore } from '@/store'
import { hasPermission, hasAnyPermission, hasAllPermissions, hasRole } from '@/utils/permissions'
import type { Permission, UserRole } from '@/types/auth'

export function useAuth() {
  const { user, token, isAuthenticated, login, logout, updateUser, touchActivity, checkSession, rememberMe } =
    useAuthStore()

  return {
    user,
    token,
    isAuthenticated,
    login,
    logout,
    updateUser,
    touchActivity,
    checkSession,
    rememberMe,
    permissions: user?.permissions ?? [],
    role: user?.role,
  }
}

export function usePermission() {
  const permissions = useAuthStore((s) => s.user?.permissions)
  const role = useAuthStore((s) => s.user?.role)

  return {
    can: (permission: Permission) => hasPermission(permissions, permission),
    canAny: (perms: Permission[]) => hasAnyPermission(permissions, perms),
    canAll: (perms: Permission[]) => hasAllPermissions(permissions, perms),
    hasRole: (roles: UserRole[]) => hasRole(role, roles),
    permissions,
    role,
  }
}
