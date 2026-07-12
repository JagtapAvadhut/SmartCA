import { COLLECTION, getCollection, type CollectionKey } from '@/db'
import { simulateDelay } from '@/services/api'

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

const ENTITY_META: Record<ArchiveEntity, { collection: CollectionKey; title: (r: Record<string, unknown>) => string; subtitle: (r: Record<string, unknown>) => string }> = {
  clients: {
    collection: COLLECTION.clients,
    title: (r) => String(r.name || r.id),
    subtitle: (r) => String(r.email || r.pan || ''),
  },
  companies: {
    collection: COLLECTION.companies,
    title: (r) => String(r.name || r.id),
    subtitle: (r) => String(r.cin || r.industry || ''),
  },
  employees: {
    collection: COLLECTION.employees,
    title: (r) => `${r.firstName || ''} ${r.lastName || ''}`.trim() || String(r.id),
    subtitle: (r) => String(r.email || r.designation || ''),
  },
  invoices: {
    collection: COLLECTION.invoices,
    title: (r) => String(r.invoiceNumber || r.id),
    subtitle: (r) => String(r.clientName || r.status || ''),
  },
  tasks: {
    collection: COLLECTION.tasks,
    title: (r) => String(r.title || r.id),
    subtitle: (r) => String(r.clientName || r.status || ''),
  },
  documents: {
    collection: COLLECTION.documents,
    title: (r) => String(r.name || r.id),
    subtitle: (r) => String(r.clientName || r.folder || ''),
  },
  payments: {
    collection: COLLECTION.payments,
    title: (r) => String(r.reference || r.id),
    subtitle: (r) => String(r.clientName || ''),
  },
  notes: {
    collection: COLLECTION.notes,
    title: (r) => String(r.title || r.id),
    subtitle: (r) => String(r.body || '').slice(0, 80),
  },
}

function mapArchived(entity: ArchiveEntity): ArchivedItem[] {
  const meta = ENTITY_META[entity]
  return getCollection(meta.collection)
    .find({ includeArchived: true, pageSize: 100000 })
    .filter((r) => r.archived)
    .map((r) => {
      const raw = r as unknown as Record<string, unknown>
      return {
        id: String(r.id),
        entity,
        title: meta.title(raw),
        subtitle: meta.subtitle(raw),
        archivedAt: String(r.updatedAt || r.createdAt || ''),
        raw,
      }
    })
}

export const ArchiveService = {
  async list(entity?: ArchiveEntity | 'all'): Promise<ArchivedItem[]> {
    await simulateDelay(100)
    const keys = (Object.keys(ENTITY_META) as ArchiveEntity[])
    const selected = !entity || entity === 'all' ? keys : [entity]
    return selected.flatMap(mapArchived).sort((a, b) => b.archivedAt.localeCompare(a.archivedAt))
  },

  async restore(entity: ArchiveEntity, id: string) {
    await simulateDelay(150)
    return getCollection(ENTITY_META[entity].collection).restore(id)
  },

  async permanentDelete(entity: ArchiveEntity, id: string) {
    await simulateDelay(150)
    return getCollection(ENTITY_META[entity].collection).delete(id)
  },

  async bulkRestore(items: Array<{ entity: ArchiveEntity; id: string }>) {
    items.forEach((i) => getCollection(ENTITY_META[i.entity].collection).restore(i.id))
    return { success: true, count: items.length }
  },

  async bulkDelete(items: Array<{ entity: ArchiveEntity; id: string }>) {
    items.forEach((i) => getCollection(ENTITY_META[i.entity].collection).delete(i.id))
    return { success: true, count: items.length }
  },
}
