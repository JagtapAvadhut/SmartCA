import { useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronLeft, ChevronRight, Scale } from 'lucide-react'
import { getFilteredNavigation } from '@/constants/navigation'
import { useAppStore } from '@/store'
import { usePermission } from '@/hooks/useAuth'
import { cn } from '@/utils'
import { APP_NAME } from '@/config/env'

export function Sidebar() {
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)
  const { permissions } = usePermission()
  const location = useLocation()
  const navigate = useNavigate()
  const [expandedMenus, setExpandedMenus] = useState<string[]>(['compliance'])

  const navigation = getFilteredNavigation(permissions)

  const toggleMenu = (id: string) => {
    setExpandedMenus((prev) => prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id])
  }

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 flex flex-col transition-all duration-300',
        sidebarCollapsed ? 'w-[72px]' : 'w-64'
      )}
    >
      <div className="flex items-center h-16 px-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary-600 to-primary-700 flex items-center justify-center shadow-lg shadow-primary-500/20">
            <Scale className="h-5 w-5 text-white" />
          </div>
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.div initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto' }} exit={{ opacity: 0, width: 0 }} className="overflow-hidden">
                <h1 className="text-lg font-bold text-gray-900 dark:text-white whitespace-nowrap">{APP_NAME}</h1>
                <p className="text-[10px] text-gray-400 -mt-0.5 whitespace-nowrap">Practice Management</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-thin py-4 px-3 space-y-1">
        {navigation.map((item) => {
          const Icon = item.icon
          const hasChildren = item.children && item.children.length > 0
          const active = isActive(item.path)
          const expanded = expandedMenus.includes(item.id)

          return (
            <div key={item.id}>
              {hasChildren ? (
                <>
                  <button
                    type="button"
                    title={sidebarCollapsed ? item.label : undefined}
                    aria-expanded={!sidebarCollapsed && expanded}
                    aria-label={item.label}
                    onClick={() => {
                      if (sidebarCollapsed) {
                        navigate(item.path)
                        return
                      }
                      toggleMenu(item.id)
                    }}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                      active ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    {!sidebarCollapsed && (
                      <>
                        <span className="flex-1 text-left">{item.label}</span>
                        <ChevronDown className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')} />
                      </>
                    )}
                  </button>
                  <AnimatePresence>
                    {expanded && !sidebarCollapsed && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden ml-4 mt-1 space-y-0.5">
                        {item.children!.map((child) => {
                          const ChildIcon = child.icon
                          return (
                            <NavLink key={child.id} to={child.path} className={({ isActive: childActive }) => cn(
                              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200',
                              childActive ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-medium' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                            )}>
                              <ChildIcon className="h-4 w-4" />
                              <span>{child.label}</span>
                            </NavLink>
                          )
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              ) : (
                <NavLink
                  to={item.path}
                  className={({ isActive: linkActive }) => cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                    linkActive ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
                  )}
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {!sidebarCollapsed && <span>{item.label}</span>}
                </NavLink>
              )}
            </div>
          )
        })}
      </nav>

      <div className="p-3 border-t border-gray-100 dark:border-gray-800 shrink-0">
        <button onClick={toggleSidebar} className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!sidebarCollapsed}>
          {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <><ChevronLeft className="h-4 w-4" /><span>Collapse</span></>}
        </button>
      </div>
    </aside>
  )
}
