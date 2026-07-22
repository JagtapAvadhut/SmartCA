import { Outlet } from 'react-router'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { CommandPalette } from '@/components/common'
import { useAppStore } from '@/store'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { useSessionTimeout } from '@/hooks/useSessionTimeout'
import { cn } from '@/utils'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { getFilteredNavigation } from '@/constants/navigation'
import { usePermission } from '@/hooks/useAuth'
import { NavLink } from 'react-router'

function MobileSidebar() {
  const sidebarMobileOpen = useAppStore((s) => s.sidebarMobileOpen)
  const setSidebarMobileOpen = useAppStore((s) => s.setSidebarMobileOpen)
  const { permissions } = usePermission()
  const navigation = getFilteredNavigation(permissions)

  return (
    <AnimatePresence>
      {sidebarMobileOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm lg:hidden" onClick={() => setSidebarMobileOpen(false)} />
          <motion.aside initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} className="fixed left-0 top-0 z-50 h-screen w-72 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 lg:hidden">
            <div className="flex items-center justify-between h-16 px-4 border-b border-gray-100 dark:border-gray-800">
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">Smart CA</h1>
              <button onClick={() => setSidebarMobileOpen(false)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Close menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="p-4 space-y-1 overflow-y-auto h-[calc(100vh-4rem)]">
              {navigation.map((item) => {
                const Icon = item.icon
                const hasChildren = item.children && item.children.length > 0
                return (
                  <div key={item.id}>
                    <NavLink to={item.path} onClick={() => setSidebarMobileOpen(false)} className={({ isActive }) => cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium',
                      isActive ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                    )}>
                      <Icon className="h-5 w-5" />
                      <span>{item.label}</span>
                    </NavLink>
                    {hasChildren && (
                      <div className="ml-4 mt-0.5 space-y-0.5 border-l border-gray-100 dark:border-gray-800 pl-3">
                        {item.children!.map((child) => (
                          <NavLink
                            key={child.id}
                            to={child.path}
                            onClick={() => setSidebarMobileOpen(false)}
                            className={({ isActive }) => cn(
                              'block px-3 py-2 rounded-lg text-sm',
                              isActive ? 'text-primary-700 dark:text-primary-300 font-medium' : 'text-gray-500 dark:text-gray-400'
                            )}
                          >
                            {child.label}
                          </NavLink>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </nav>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

export function AppLayout() {
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed)
  const isMobile = useIsMobile()
  useSessionTimeout()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="hidden lg:block"><Sidebar /></div>
      <MobileSidebar />
      <Topbar />
      <main className={cn('pt-16 min-h-screen transition-all duration-300 min-w-0', isMobile ? 'pl-0' : sidebarCollapsed ? 'pl-[72px]' : 'pl-64')}>
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-200/80 dark:border-emerald-800/60 px-4 py-2 text-center text-xs text-emerald-900 dark:text-emerald-100">
          Connected to Smart CA API — business data is persisted in PostgreSQL. AI responses are generated server-side via Gemini.
        </div>
        <div className="page-container min-w-0">
          <Outlet />
        </div>
      </main>
      <CommandPalette />
    </div>
  )
}
