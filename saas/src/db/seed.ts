/**
 * Seed / collection name constants.
 * Business data lives on the Go API — MockDatabase is not auto-initialized.
 */

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

/** No-op — business seed lives in the Go backend. */
export function initDatabase(_force = false) {
  /* intentionally empty */
}

/** Demo reset is POST /api/v1/demo/reset on the backend. */
export function resetDatabase() {
  throw new Error('Use POST /api/v1/demo/reset on the Go backend to reset demo data')
}

/**
 * @deprecated Business collections are served by the REST API.
 * Throws if called so LocalStorage business DB cannot be reintroduced silently.
 */
export function getCollection(
  _name: CollectionKey,
): never {
  throw new Error(
    `getCollection(${_name}) is disabled — use the Go REST API via src/services instead of MockDatabase`,
  )
}
