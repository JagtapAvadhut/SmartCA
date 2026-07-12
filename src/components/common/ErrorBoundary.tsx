import { Component, type ReactNode, type ErrorInfo } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import { Button } from './Button'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="min-h-[400px] flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <div className="h-16 w-16 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Something went wrong</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              {this.state.error?.message || 'An unexpected error occurred. Please try again.'}
            </p>
            <div className="flex items-center justify-center gap-3">
              <Button onClick={this.handleRetry} variant="outline">
                <RefreshCw className="h-4 w-4" /> Try Again
              </Button>
              <Button onClick={() => (window.location.href = '/')}>
                <Home className="h-4 w-4" /> Go Home
              </Button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
