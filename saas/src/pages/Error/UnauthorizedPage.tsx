import { Link } from 'react-router'
import { ShieldX, Home } from 'lucide-react'
import { Button } from '@/components/common/Button'
import { useAuth } from '@/hooks/useAuth'

export default function UnauthorizedPage() {
  const { user } = useAuth()

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="h-16 w-16 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-4">
          <ShieldX className="h-8 w-8 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
          You don't have permission to access this page.
        </p>
        {user && (
          <p className="text-xs text-gray-400 mb-8">
            Logged in as {user.fullName} ({user.roleName})
          </p>
        )}
        <Link to="/"><Button><Home className="h-4 w-4" /> Return to Dashboard</Button></Link>
      </div>
    </div>
  )
}
