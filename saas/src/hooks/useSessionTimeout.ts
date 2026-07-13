import { useEffect } from 'react'
import { useAuthStore } from '@/store'

export function useSessionTimeout() {
  const { isAuthenticated, rememberMe, touchActivity, checkSession } = useAuthStore()

  useEffect(() => {
    if (!isAuthenticated || rememberMe) return

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart']
    const handler = () => touchActivity()
    events.forEach((e) => window.addEventListener(e, handler))

    const interval = setInterval(() => {
      if (!checkSession()) {
        window.location.href = '/login'
      }
    }, 60000)

    return () => {
      events.forEach((e) => window.removeEventListener(e, handler))
      clearInterval(interval)
    }
  }, [isAuthenticated, rememberMe, touchActivity, checkSession])
}
