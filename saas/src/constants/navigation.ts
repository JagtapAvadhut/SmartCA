import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard, Users, Building2, ShieldCheck, Receipt, FileText,
  Calculator, CreditCard, FolderOpen, CheckSquare, BarChart3, UserCog, Bot, Settings, IndianRupee, Scale,
  StickyNote, CalendarDays, Trash2,
} from 'lucide-react'
import type { Permission } from '@/types/auth'

export interface NavItem {
  id: string
  label: string
  path: string
  icon: LucideIcon
  permission?: Permission
  children?: NavItem[]
  badge?: number
}

export const NAVIGATION: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', path: '/', icon: LayoutDashboard, permission: 'dashboard.view' },
  { id: 'clients', label: 'Clients', path: '/clients', icon: Users, permission: 'clients.view' },
  { id: 'companies', label: 'Companies', path: '/companies', icon: Building2, permission: 'companies.view' },
  {
    id: 'compliance', label: 'Compliance', path: '/compliance', icon: ShieldCheck, permission: 'compliance.view',
    children: [
      { id: 'gst', label: 'GST', path: '/compliance/gst', icon: Receipt, permission: 'gst.view' },
      { id: 'itr', label: 'Income Tax', path: '/compliance/itr', icon: FileText, permission: 'itr.view' },
      { id: 'tds', label: 'TDS', path: '/compliance/tds', icon: IndianRupee, permission: 'tds.view' },
      { id: 'roc', label: 'ROC', path: '/compliance/roc', icon: Scale, permission: 'roc.view' },
    ],
  },
  { id: 'accounting', label: 'Accounting', path: '/accounting', icon: Calculator, permission: 'accounting.view' },
  { id: 'invoices', label: 'Invoices', path: '/invoices', icon: FileText, permission: 'invoices.view' },
  { id: 'payments', label: 'Payments', path: '/payments', icon: CreditCard, permission: 'payments.view' },
  { id: 'documents', label: 'Documents', path: '/documents', icon: FolderOpen, permission: 'documents.view' },
  { id: 'tasks', label: 'Tasks', path: '/tasks', icon: CheckSquare, permission: 'tasks.view' },
  { id: 'notes', label: 'Notes', path: '/notes', icon: StickyNote, permission: 'dashboard.view' },
  { id: 'calendar', label: 'Calendar', path: '/calendar', icon: CalendarDays, permission: 'dashboard.view' },
  { id: 'reports', label: 'Reports', path: '/reports', icon: BarChart3, permission: 'reports.view' },
  { id: 'employees', label: 'Employees', path: '/employees', icon: UserCog, permission: 'employees.view' },
  { id: 'recycle', label: 'Recycle Bin', path: '/recycle-bin', icon: Trash2, permission: 'settings.view' },
  { id: 'ai', label: 'AI Assistant', path: '/ai', icon: Bot, permission: 'ai.view' },
  { id: 'settings', label: 'Settings', path: '/settings', icon: Settings, permission: 'settings.view' },
]

export function getFilteredNavigation(permissions: Permission[] | undefined): NavItem[] {
  const perms = permissions ?? []
  return NAVIGATION
    .filter((item) => !item.permission || perms.includes(item.permission))
    .map((item) => ({
      ...item,
      children: item.children?.filter((c) => !c.permission || perms.includes(c.permission)),
    }))
    .filter((item) => !item.children || item.children.length > 0)
}
