import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { Menu, Search, Bell, Globe, Settings, LogOut, Command, Sun, Moon, Monitor } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore, useThemeStore } from '@/store'
import { useNotificationStore } from '@/store/notificationStore'
import { useAuth } from '@/hooks/useAuth'
import { AuthService } from '@/services/authService'
import { Avatar } from '@/components/common'
import { cn, formatRelativeTime } from '@/utils'
import { useIsMobile } from '@/hooks/useMediaQuery'
import toast from 'react-hot-toast'
import type { ThemeMode } from '@/types/auth'

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिंदी' },
]

const THEME_OPTIONS: { mode: ThemeMode; icon: typeof Sun; label: string }[] = [
  { mode: 'light', icon: Sun, label: 'Light' },
  { mode: 'dark', icon: Moon, label: 'Dark' },
  { mode: 'system', icon: Monitor, label: 'System' },
]

export function Topbar() {
  const navigate = useNavigate()
  const { sidebarCollapsed, setSidebarMobileOpen, setCommandPaletteOpen } = useAppStore()
  const { mode, setMode, language, setLanguage } = useThemeStore()
  const { user, logout } = useAuth()
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotificationStore()
  const [showProfile, setShowProfile] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showLanguage, setShowLanguage] = useState(false)
  const [showTheme, setShowTheme] = useState(false)
  const isMobile = useIsMobile()
  const notifRef = useRef<HTMLDivElement>(null)
  const profileRef = useRef<HTMLDivElement>(null)
  const themeRef = useRef<HTMLDivElement>(null)
  const languageRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node
      if (notifRef.current && !notifRef.current.contains(t)) setShowNotifications(false)
      if (profileRef.current && !profileRef.current.contains(t)) setShowProfile(false)
      if (themeRef.current && !themeRef.current.contains(t)) setShowTheme(false)
      if (languageRef.current && !languageRef.current.contains(t)) setShowLanguage(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowNotifications(false)
        setShowProfile(false)
        setShowTheme(false)
        setShowLanguage(false)
      }
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  const handleLogout = async () => {
    try {
      await AuthService.logout()
      logout()
      toast.success('Signed out successfully')
      navigate('/login')
    } catch {
      logout()
      navigate('/login')
    }
  }

  return (
    <header className={cn(
      'fixed top-0 right-0 z-30 h-16 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-100 dark:border-gray-800 flex items-center justify-between px-4 lg:px-6 transition-all duration-300',
      isMobile ? 'left-0' : sidebarCollapsed ? 'left-[72px]' : 'left-64'
    )}>
      <div className="flex items-center gap-3">
        {isMobile && (
          <button onClick={() => setSidebarMobileOpen(true)} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400" aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
        )}
        <button
          type="button"
          onClick={() => setCommandPaletteOpen(true)}
          aria-label="Open command palette"
          className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors w-[min(100%,16rem)] sm:w-64 max-w-full"
        >
          <Search className="h-4 w-4" />
          <span className="hidden sm:inline">Search anything...</span>
          <kbd className="ml-auto hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded text-gray-400">
            <Command className="h-3 w-3 mr-0.5" />K
          </kbd>
        </button>
      </div>

      <div className="flex items-center gap-1">
        <div className="relative" ref={themeRef}>
          <button type="button" onClick={() => { setShowTheme(!showTheme); setShowLanguage(false) }} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors" aria-label="Theme" aria-expanded={showTheme}>
            {mode === 'dark' ? <Moon className="h-5 w-5" /> : mode === 'light' ? <Sun className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
          </button>
          <AnimatePresence>
            {showTheme && (
              <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }} className="absolute right-0 top-12 w-40 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 py-1 z-50">
                {THEME_OPTIONS.map(({ mode: m, icon: Icon, label }) => (
                  <button key={m} type="button" onClick={() => { setMode(m); setShowTheme(false); toast.success(`${label} theme applied`) }} className={cn('w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700', mode === m && 'text-primary-600 dark:text-primary-400 font-medium')}>
                    <Icon className="h-4 w-4" /> {label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="relative hidden sm:block" ref={languageRef}>
          <button type="button" onClick={() => { setShowLanguage(!showLanguage); setShowTheme(false) }} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors" aria-label="Language" aria-expanded={showLanguage}>
            <Globe className="h-5 w-5" />
          </button>
          <AnimatePresence>
            {showLanguage && (
              <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }} className="absolute right-0 top-12 w-44 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 py-1 z-50">
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => {
                      setLanguage(lang.code)
                      setShowLanguage(false)
                      toast.success(
                        lang.code === 'en'
                          ? 'Language preference: English'
                          : 'Language preference saved (UI remains English in v1.0 demo)',
                      )
                    }}
                    className={cn('w-full px-4 py-2 text-sm text-left hover:bg-gray-50 dark:hover:bg-gray-700', language === lang.code && 'text-primary-600 dark:text-primary-400 font-medium')}
                  >
                    {lang.label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="relative" ref={notifRef}>
          <button type="button" onClick={() => setShowNotifications(!showNotifications)} className="relative p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors" aria-label="Notifications" aria-expanded={showNotifications}>
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 h-4 w-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center font-medium">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          <AnimatePresence>
            {showNotifications && (
              <motion.div initial={{ opacity: 0, y: 8, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.95 }} className="absolute right-0 top-12 w-80 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 z-50 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                  <h3 className="font-semibold text-gray-900 dark:text-white">Notifications</h3>
                  {unreadCount > 0 && (
                    <button type="button" onClick={() => { markAllAsRead(); toast.success('All marked as read') }} className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700">Mark all read</button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-8">No notifications</p>
                  ) : notifications.slice(0, 10).map((n) => (
                    <div key={n.id} className={cn('p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer border-b border-gray-50 dark:border-gray-700/50', !n.read && 'bg-primary-50/50 dark:bg-primary-900/10')} onClick={() => { markAsRead(n.id); if (n.link) navigate(n.link); setShowNotifications(false) }}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{n.title}</p>
                        {!n.read && <span className="h-2 w-2 bg-primary-500 rounded-full shrink-0 mt-1.5" />}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-xs text-gray-400 mt-1">{formatRelativeTime(n.createdAt)}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="relative" ref={profileRef}>
          <button type="button" onClick={() => setShowProfile(!showProfile)} className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" aria-label="Profile menu" aria-expanded={showProfile}>
            <Avatar src={user?.avatar} name={user?.fullName || 'User'} size="sm" />
            <span className="hidden md:block text-sm font-medium text-gray-700 dark:text-gray-300">{user?.firstName}</span>
          </button>
          <AnimatePresence>
            {showProfile && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="absolute right-0 top-12 w-56 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 py-2 z-50">
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{user?.fullName}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{user?.email}</p>
                  <p className="text-xs text-primary-600 dark:text-primary-400 mt-0.5">{user?.roleName}</p>
                </div>
                <button type="button" onClick={() => { navigate('/settings'); setShowProfile(false) }} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
                  <Settings className="h-4 w-4" /> Settings
                </button>
                <button type="button" onClick={handleLogout} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
                  <LogOut className="h-4 w-4" /> Sign Out
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  )
}
