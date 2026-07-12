import { MockDatabase, type BaseRecord } from './MockDatabase'

import clientsJson from '@/mock/clients.json'
import companiesJson from '@/mock/companies.json'
import employeesJson from '@/mock/employees.json'
import invoicesJson from '@/mock/invoices.json'
import paymentsJson from '@/mock/payments.json'
import documentsJson from '@/mock/documents.json'
import tasksJson from '@/mock/tasks.json'
import gstJson from '@/mock/gst.json'
import itrJson from '@/mock/itr.json'
import tdsJson from '@/mock/tds.json'
import rocJson from '@/mock/roc.json'
import complianceJson from '@/mock/compliance.json'
import notificationsJson from '@/mock/notifications.json'
import activitiesJson from '@/mock/activities.json'
import calendarJson from '@/mock/calendar.json'
import usersJson from '@/mock/users.json'
import rolesJson from '@/mock/roles.json'
import permissionsJson from '@/mock/permissions.json'
import organizationJson from '@/mock/organization.json'
import settingsJson from '@/mock/settings.json'
import auditLogsJson from '@/mock/auditLogs.json'
import loginHistoryJson from '@/mock/loginHistory.json'
import chatJson from '@/mock/chat.json'
import departmentsJson from '@/mock/departments.json'
import branchesJson from '@/mock/branches.json'
import dashboardJson from '@/mock/dashboard.json'
import reportsJson from '@/mock/reports.json'

function asArray(data: unknown): BaseRecord[] {
  if (Array.isArray(data)) return data as BaseRecord[]
  if (data && typeof data === 'object' && 'data' in data && Array.isArray((data as { data: unknown }).data)) {
    return (data as { data: BaseRecord[] }).data
  }
  if (data && typeof data === 'object' && 'sessions' in data) {
    return (data as { sessions: BaseRecord[] }).sessions
  }
  return []
}

function wrapSingleton(id: string, data: unknown): BaseRecord[] {
  return [{ id, ...(data as object) } as BaseRecord]
}

export const COLLECTION = {
  clients: 'clients',
  companies: 'companies',
  employees: 'employees',
  invoices: 'invoices',
  payments: 'payments',
  documents: 'documents',
  tasks: 'tasks',
  gst: 'gst',
  itr: 'itr',
  tds: 'tds',
  roc: 'roc',
  compliance: 'compliance',
  notifications: 'notifications',
  activities: 'activities',
  calendar: 'calendar',
  users: 'users',
  roles: 'roles',
  permissions: 'permissions',
  organization: 'organization',
  settings: 'settings',
  auditLogs: 'auditLogs',
  loginHistory: 'loginHistory',
  chat: 'chat',
  departments: 'departments',
  branches: 'branches',
  dashboard: 'dashboard',
  reports: 'reports',
  notes: 'notes',
} as const

export type CollectionKey = (typeof COLLECTION)[keyof typeof COLLECTION]

function buildSeedData(): Record<string, BaseRecord[]> {
  return {
    [COLLECTION.clients]: asArray(clientsJson),
    [COLLECTION.companies]: asArray(companiesJson),
    [COLLECTION.employees]: asArray(employeesJson),
    [COLLECTION.invoices]: asArray(invoicesJson),
    [COLLECTION.payments]: asArray(paymentsJson),
    [COLLECTION.documents]: asArray(documentsJson),
    [COLLECTION.tasks]: asArray(tasksJson),
    [COLLECTION.gst]: asArray(gstJson),
    [COLLECTION.itr]: asArray(itrJson),
    [COLLECTION.tds]: asArray(tdsJson),
    [COLLECTION.roc]: asArray(rocJson),
    [COLLECTION.compliance]: asArray(complianceJson),
    [COLLECTION.notifications]: asArray(notificationsJson),
    [COLLECTION.activities]: asArray(activitiesJson),
    [COLLECTION.calendar]: asArray(calendarJson),
    [COLLECTION.users]: asArray(usersJson),
    [COLLECTION.roles]: asArray(rolesJson),
    [COLLECTION.permissions]: asArray(permissionsJson),
    [COLLECTION.organization]: wrapSingleton('ORG-001', organizationJson),
    [COLLECTION.settings]: wrapSingleton('SETTINGS-001', settingsJson),
    [COLLECTION.auditLogs]: asArray(auditLogsJson),
    [COLLECTION.loginHistory]: asArray(loginHistoryJson),
    [COLLECTION.chat]: asArray(chatJson),
    [COLLECTION.departments]: asArray(departmentsJson),
    [COLLECTION.branches]: asArray(branchesJson),
    [COLLECTION.dashboard]: wrapSingleton('DASH-001', dashboardJson),
    [COLLECTION.reports]: wrapSingleton('RPT-001', reportsJson),
    [COLLECTION.notes]: ([
      {
        id: 'NOTE-0001',
        title: 'FY 2025-26 kickoff',
        body: 'Confirm GST calendar, assign ITR owners, and review outstanding invoices before client demos.',
        pinned: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'NOTE-0002',
        title: 'Partner meeting talking points',
        body: 'Highlight live dashboard metrics, LocalStorage persistence, and role-based navigation during demos.',
        pinned: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ] as unknown) as BaseRecord[],
  }
}

let initialized = false

export function initDatabase(force = false) {
  if (initialized && !force) return
  MockDatabase.seed(buildSeedData(), force)
  initialized = true
}

export function resetDatabase() {
  MockDatabase.reset(buildSeedData())
  initialized = true
}

export function getCollection<T extends { id: string } = BaseRecord & Record<string, unknown>>(name: CollectionKey) {
  initDatabase()
  return MockDatabase.collection<T>(name)
}

// Auto-init on import in browser
if (typeof window !== 'undefined') {
  initDatabase()
}
