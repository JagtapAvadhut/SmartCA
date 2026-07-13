export type Permission =
  | 'dashboard.view'
  | 'clients.view' | 'clients.create' | 'clients.edit' | 'clients.delete'
  | 'companies.view' | 'companies.create' | 'companies.edit'
  | 'compliance.view' | 'compliance.create' | 'compliance.edit' | 'compliance.delete'
  | 'gst.view' | 'itr.view' | 'tds.view' | 'roc.view'
  | 'accounting.view'
  | 'invoices.view' | 'invoices.create' | 'invoices.edit' | 'invoices.delete'
  | 'payments.view' | 'payments.create'
  | 'documents.view' | 'documents.upload' | 'documents.delete'
  | 'tasks.view' | 'tasks.create' | 'tasks.edit' | 'tasks.delete'
  | 'reports.view' | 'reports.export'
  | 'employees.view' | 'employees.create' | 'employees.edit'
  | 'ai.view'
  | 'settings.view' | 'settings.edit' | 'settings.users' | 'settings.roles'
  | 'settings.security' | 'settings.branding' | 'settings.api'

export type UserRole =
  | 'super_admin' | 'admin' | 'partner' | 'ca' | 'senior_ca' | 'junior_ca'
  | 'accountant' | 'article_assistant' | 'receptionist' | 'auditor'
  | 'client' | 'hr' | 'finance' | 'employee'

export type ThemeMode = 'light' | 'dark' | 'system'

export interface AuthUser {
  id: string
  employeeId: string
  firstName: string
  lastName: string
  fullName: string
  email: string
  loginId: string
  username: string
  mobile: string
  designation: string
  department: string
  organization: string
  branch: string
  role: UserRole
  roleName: string
  permissions: Permission[]
  status: 'active' | 'inactive'
  profileImage: string
  avatar: string
  joiningDate: string
  lastLogin: string
  themePreference: ThemeMode
  language: string
  address: string
  city: string
  state: string
  country: string
  pincode: string
  gstin: string
  pan: string
  aadhaar: string
  bio: string
}

export interface LoginCredentials {
  identifier: string
  password: string
  rememberMe?: boolean
}

export interface Session {
  id: string
  userId: string
  token: string
  device: string
  ip: string
  createdAt: string
  expiresAt: string
  active: boolean
}

export interface Role {
  id: string
  name: string
  level: number
  permissions: Permission[]
  userCount: number
}

export const ROUTE_PERMISSIONS: Record<string, Permission> = {
  '/': 'dashboard.view',
  '/clients': 'clients.view',
  '/companies': 'companies.view',
  '/compliance': 'compliance.view',
  '/compliance/gst': 'gst.view',
  '/compliance/itr': 'itr.view',
  '/compliance/tds': 'tds.view',
  '/compliance/roc': 'roc.view',
  '/accounting': 'accounting.view',
  '/invoices': 'invoices.view',
  '/payments': 'payments.view',
  '/documents': 'documents.view',
  '/tasks': 'tasks.view',
  '/notes': 'dashboard.view',
  '/calendar': 'dashboard.view',
  '/reports': 'reports.view',
  '/employees': 'employees.view',
  '/recycle-bin': 'settings.view',
  '/ai': 'ai.view',
  '/settings': 'settings.view',
}

export const SESSION_TIMEOUT_MS = 30 * 60 * 1000
