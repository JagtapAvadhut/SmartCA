import { Link } from 'react-router'
import { Home, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/common/Button'

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-8">
      <div className="text-center max-w-md">
        <p className="text-8xl font-bold text-primary-600 mb-4">404</p>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Page not found</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link to="/"><Button><Home className="h-4 w-4" /> Go to Dashboard</Button></Link>
          <Button variant="outline" onClick={() => window.history.back()}>
            <ArrowLeft className="h-4 w-4" /> Go Back
          </Button>
        </div>
      </div>
    </div>
  )
}
