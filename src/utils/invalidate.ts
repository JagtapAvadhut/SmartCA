import type { QueryClient } from '@tanstack/react-query'

/** Invalidate live analytics + common domain caches after mutations */
export function invalidateAfterMutation(qc: QueryClient, extra: string[] = []) {
  const keys = [
    'dashboard',
    'reports',
    'clients',
    'companies',
    'employees',
    'invoices',
    'payments',
    'documents',
    'tasks',
    'compliance',
    'gst',
    'itr',
    'tds',
    'roc',
    'notifications',
    'notes',
    'settings',
    'organization',
    'settings-users',
    'roles',
    'calendar',
    ...extra,
  ]
  keys.forEach((key) => {
    void qc.invalidateQueries({ queryKey: [key] })
  })
}
