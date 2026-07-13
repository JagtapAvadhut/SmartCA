import { http } from './httpClient'

export type ArchiveEntity =
  | 'clients'
  | 'companies'
  | 'employees'
  | 'invoices'
  | 'tasks'
  | 'documents'
  | 'payments'
  | 'notes'

export interface ArchivedItem {
  id: string
  entity: ArchiveEntity
  title: string
  subtitle: string
  archivedAt: string
  raw: Record<string, unknown>
}

const TITLE_FN: Record<ArchiveEntity, (r: Record<string, unknown>) => string> = {
  clients: (r) => String(r.name || r.id),
  companies: (r) => String(r.name || r.id),
  employees: (r) => `${r.firstName || ''} ${r.lastName || ''}`.trim() || String(r.id),
  invoices: (r) => String(r.invoiceNumber || r.id),
  tasks: (r) => String(r.title || r.id),
  documents: (r) => String(r.name || r.id),
  payments: (r) => String(r.reference || r.id),
  notes: (r) => String(r.title || r.id),
}

const SUBTITLE_FN: Record<ArchiveEntity, (r: Record<string, unknown>) => string> = {
  clients: (r) => String(r.email || r.pan || ''),
  companies: (r) => String(r.cin || r.industry || ''),
  employees: (r) => String(r.email || r.designation || ''),
  invoices: (r) => String(r.clientName || r.status || ''),
  tasks: (r) => String(r.clientName || r.status || ''),
  documents: (r) => String(r.clientName || r.folder || ''),
  payments: (r) => String(r.clientName || ''),
  notes: (r) => String(r.body || '').slice(0, 80),
}

function mapRow(entity: ArchiveEntity, r: Record<string, unknown>): ArchivedItem {
  return {
    id: String(r.id),
    entity,
    title: TITLE_FN[entity](r),
    subtitle: SUBTITLE_FN[entity](r),
    archivedAt: String(r.archivedAt || r.updatedAt || r.createdAt || ''),
    raw: r,
  }
}

const ALL_ENTITIES = Object.keys(TITLE_FN) as ArchiveEntity[]

export const ArchiveService = {
  async list(entity?: ArchiveEntity | 'all'): Promise<ArchivedItem[]> {
    if (!entity || entity === 'all') {
      const map = await http.get<Record<string, Record<string, unknown>[]>>('/archive')
      const items: ArchivedItem[] = []
      for (const key of ALL_ENTITIES) {
        const rows = map?.[key] || []
        rows.forEach((r) => items.push(mapRow(key, r)))
      }
      return items.sort((a, b) => b.archivedAt.localeCompare(a.archivedAt))
    }
    const rows = await http.get<Record<string, unknown>[]>('/archive', {
      params: { collection: entity },
    })
    return (rows || []).map((r) => mapRow(entity, r))
  },

  async restore(entity: ArchiveEntity, id: string) {
    return http.post('/archive/restore', { collection: entity, id })
  },

  async permanentDelete(entity: ArchiveEntity, id: string) {
    return http.post('/archive/permanent', { collection: entity, id })
  },

  async bulkRestore(items: Array<{ entity: ArchiveEntity; id: string }>) {
    const res = await http.post<{ restored: number }>('/archive/bulk-restore', {
      items: items.map((i) => ({ collection: i.entity, id: i.id })),
    })
    return { success: true, count: res.restored ?? items.length }
  },

  async bulkDelete(items: Array<{ entity: ArchiveEntity; id: string }>) {
    const res = await http.post<{ deleted: number }>('/archive/bulk-permanent', {
      items: items.map((i) => ({ collection: i.entity, id: i.id })),
    })
    return { success: true, count: res.deleted ?? items.length }
  },
}
