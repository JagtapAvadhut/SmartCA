import { useEffect } from 'react'
import { RouterProvider } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { router } from '@/routes'
import { ErrorBoundary } from '@/components/common'
import { useThemeStore } from '@/store'
import { useNotificationStore } from '@/store/notificationStore'
import { applyBrandingFromSettings } from '@/utils/branding'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
})

function AppProviders({ children }: { children: React.ReactNode }) {
  const initTheme = useThemeStore((s) => s.initTheme)
  const initNotifications = useNotificationStore((s) => s.initialize)

  useEffect(() => {
    initTheme()
    initNotifications()
    applyBrandingFromSettings()
    void import('@/qa/expose').then((m) => m.exposeQaApi())
  }, [initTheme, initNotifications])

  return <>{children}</>
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AppProviders>
          <RouterProvider router={router} />
          <Toaster
            position="top-right"
            toastOptions={{
              className: 'text-sm dark:bg-gray-800 dark:text-gray-100',
              duration: 3000,
              style: { borderRadius: '12px', padding: '12px 16px' },
            }}
          />
        </AppProviders>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
