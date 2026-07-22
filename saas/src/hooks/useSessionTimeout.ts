import { useEffect } from 'react'
import { useAuthStore } from '@/store'

export function useSessionTimeout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const rememberMe = useAuthStore((s) => s.rememberMe)

  useEffect(() => {
    if (!isAuthenticated || rememberMe) return

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'] as const
    // Use getState so activity ticks do not subscribe this hook to lastActivity updates.
    const handler = () => useAuthStore.getState().touchActivity()
    events.forEach((e) => window.addEventListener(e, handler))

    const interval = setInterval(() => {
      if (!useAuthStore.getState().checkSession()) {
        window.location.href = '/login'
      }
    }, 60000)

    return () => {
      events.forEach((e) => window.removeEventListener(e, handler))
      clearInterval(interval)
    }
  }, [isAuthenticated, rememberMe])
}
