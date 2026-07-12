import { Navigate, useLocation } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { canAccessRoute } from '@/utils/permissions'
import type { Permission } from '@/types/auth'
import { DashboardSkeleton } from '@/components/common'

interface ProtectedRouteProps {
  children: React.ReactNode
  permission?: Permission
}

export function ProtectedRoute({ children, permission }: ProtectedRouteProps) {
  const { isAuthenticated, permissions, checkSession } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (!checkSession()) {
    return <Navigate to="/login" state={{ from: location, sessionExpired: true }} replace />
  }

  if (permission) {
    if (!permissions.includes(permission)) {
      return <Navigate to="/unauthorized" replace />
    }
  } else if (location.pathname !== '/unauthorized' && !canAccessRoute(permissions, location.pathname)) {
    return <Navigate to="/unauthorized" replace />
  }

  return <>{children}</>
}

export function AuthLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
      <DashboardSkeleton />
    </div>
  )
}
