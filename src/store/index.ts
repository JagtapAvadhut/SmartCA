import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { setAuthToken } from '@/services/api'
import type { AuthUser, Session, ThemeMode } from '@/types/auth'
import { SESSION_TIMEOUT_MS } from '@/types/auth'
import { getSessionTimeoutMs } from '@/utils/branding'

interface AppState {
  sidebarCollapsed: boolean
  sidebarMobileOpen: boolean
  commandPaletteOpen: boolean
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  setSidebarMobileOpen: (open: boolean) => void
  setCommandPaletteOpen: (open: boolean) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      sidebarMobileOpen: false,
      commandPaletteOpen: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      setSidebarMobileOpen: (open) => set({ sidebarMobileOpen: open }),
      setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
    }),
    { name: 'smart-ca-app', partialize: (s) => ({ sidebarCollapsed: s.sidebarCollapsed }) }
  )
)

function applyTheme(mode: ThemeMode) {
  const root = document.documentElement
  if (mode === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    root.classList.toggle('dark', prefersDark)
  } else {
    root.classList.toggle('dark', mode === 'dark')
  }
}

interface ThemeState {
  mode: ThemeMode
  language: string
  setMode: (mode: ThemeMode) => void
  setLanguage: (lang: string) => void
  initTheme: () => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'system',
      language: 'en',
      setMode: (mode) => {
        applyTheme(mode)
        set({ mode })
      },
      setLanguage: (lang) => set({ language: lang }),
      initTheme: () => applyTheme(get().mode),
    }),
    {
      name: 'smart-ca-theme',
      onRehydrateStorage: () => (state) => {
        if (state) applyTheme(state.mode)
      },
    }
  )
)

if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const { mode } = useThemeStore.getState()
    if (mode === 'system') applyTheme('system')
  })
}

interface AuthState {
  token: string | null
  user: AuthUser | null
  session: Session | null
  rememberMe: boolean
  lastActivity: number
  isAuthenticated: boolean
  login: (user: AuthUser, token: string, session: Session, rememberMe?: boolean) => void
  logout: () => void
  updateUser: (user: Partial<AuthUser>) => void
  touchActivity: () => void
  checkSession: () => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      session: null,
      rememberMe: false,
      lastActivity: Date.now(),
      isAuthenticated: false,

      login: (user, token, session, rememberMe = false) => {
        setAuthToken(token)
        set({
          token,
          user,
          session,
          rememberMe,
          lastActivity: Date.now(),
          isAuthenticated: true,
        })
        // Preserve an explicit user theme choice already stored in this browser.
        // Only apply the profile default when no theme preference was persisted yet.
        try {
          const raw = localStorage.getItem('smart-ca-theme')
          const persisted = raw ? JSON.parse(raw) : null
          const hasPersistedMode = Boolean(persisted?.state?.mode)
          if (!hasPersistedMode && user.themePreference && user.themePreference !== 'system') {
            useThemeStore.getState().setMode(user.themePreference)
          }
        } catch {
          /* ignore */
        }
      },

      logout: () => {
        setAuthToken(null)
        set({
          token: null,
          user: null,
          session: null,
          rememberMe: false,
          isAuthenticated: false,
        })
      },

      updateUser: (updates) =>
        set((s) => ({
          user: s.user ? { ...s.user, ...updates } : null,
        })),

      touchActivity: () => set({ lastActivity: Date.now() }),

      checkSession: () => {
        const { session, rememberMe, lastActivity, isAuthenticated } = get()
        if (!isAuthenticated || !session) return false
        if (rememberMe) return true
        const timeout = typeof window !== 'undefined' ? getSessionTimeoutMs() : SESSION_TIMEOUT_MS
        const expired = Date.now() - lastActivity > timeout
        if (expired) {
          get().logout()
          return false
        }
        return true
      },
    }),
    {
      name: 'smart-ca-auth',
      partialize: (s) => ({
        token: s.token,
        user: s.user,
        session: s.session,
        rememberMe: s.rememberMe,
        lastActivity: s.lastActivity,
        isAuthenticated: s.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.token) setAuthToken(state.token)
      },
    }
  )
)
