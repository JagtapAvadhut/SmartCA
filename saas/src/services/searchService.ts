import { http } from './httpClient'
import { NAVIGATION } from '@/constants/navigation'

export interface SearchResult {
  id: string
  type:
    | 'page'
    | 'client'
    | 'invoice'
    | 'document'
    | 'employee'
    | 'task'
    | 'compliance'
    | 'user'
    | 'company'
    | 'payment'
    | 'setting'
  title: string
  subtitle?: string
  path: string
  icon?: string
}

const COLLECTION_TO_TYPE: Record<string, SearchResult['type']> = {
  clients: 'client',
  companies: 'company',
  invoices: 'invoice',
  payments: 'payment',
  documents: 'document',
  employees: 'employee',
  tasks: 'task',
  compliance: 'compliance',
  gst: 'compliance',
  users: 'user',
}

const COLLECTION_PATH: Record<string, (id: string, title: string) => string> = {
  clients: (id) => `/clients/${id}`,
  companies: () => '/companies',
  invoices: (_id, title) => `/invoices?q=${encodeURIComponent(title)}`,
  payments: (_id, title) => `/payments?q=${encodeURIComponent(title)}`,
  documents: (_id, title) => `/documents?q=${encodeURIComponent(title)}`,
  employees: () => '/employees',
  tasks: (_id, title) => `/tasks?q=${encodeURIComponent(title)}`,
  compliance: () => '/compliance',
  gst: () => '/compliance/gst',
  users: () => '/settings?tab=users',
}

export const SearchService = {
  async search(query: string): Promise<SearchResult[]> {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    const results: SearchResult[] = []

    NAVIGATION.forEach((item) => {
      if (item.label.toLowerCase().includes(q)) {
        results.push({ id: item.id, type: 'page', title: item.label, path: item.path, icon: item.id })
      }
      item.children?.forEach((child) => {
        if (child.label.toLowerCase().includes(q)) {
          results.push({
            id: child.id,
            type: 'page',
            title: child.label,
            subtitle: item.label,
            path: child.path,
          })
        }
      })
    })

    const settingsHits = [
      'organization',
      'profile',
      'password',
      'users',
      'roles',
      'branding',
      'notifications',
      'security',
      'api',
      'appearance',
    ]
    settingsHits.forEach((s) => {
      if (s.includes(q) || `settings ${s}`.includes(q)) {
        results.push({
          id: `settings-${s}`,
          type: 'setting',
          title: `Settings · ${s}`,
          path: `/settings?tab=${s}`,
        })
      }
    })

    try {
      const api = await http.get<{
        query: string
        results: Array<{ collection: string; id: string; title: string; record?: Record<string, unknown> }>
      }>('/search', { params: { q: query } })

      for (const hit of api.results || []) {
        const type = COLLECTION_TO_TYPE[hit.collection] || 'client'
        const pathFn = COLLECTION_PATH[hit.collection]
        const title = hit.title || hit.id
        results.push({
          id: hit.id,
          type,
          title,
          subtitle: hit.collection,
          path: pathFn ? pathFn(hit.id, title) : '/',
        })
      }
    } catch {
      /* navigation/settings hits still returned */
    }

    // de-dupe by id+type
    const seen = new Set<string>()
    const unique = results.filter((r) => {
      const k = `${r.type}:${r.id}`
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })

    return unique.slice(0, 25)
  },
}
