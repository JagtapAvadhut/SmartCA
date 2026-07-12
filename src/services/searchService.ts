import { simulateDelay } from './api'
import { COLLECTION, getCollection } from '@/db'
import { NAVIGATION } from '@/constants/navigation'

export interface SearchResult {
  id: string
  type: 'page' | 'client' | 'invoice' | 'document' | 'employee' | 'task' | 'compliance' | 'user' | 'company' | 'payment' | 'setting'
  title: string
  subtitle?: string
  path: string
  icon?: string
}

export const SearchService = {
  async search(query: string): Promise<SearchResult[]> {
    await simulateDelay(120)
    if (!query.trim()) return []
    const q = query.toLowerCase()
    const results: SearchResult[] = []

    NAVIGATION.forEach((item) => {
      if (item.label.toLowerCase().includes(q)) {
        results.push({ id: item.id, type: 'page', title: item.label, path: item.path, icon: item.id })
      }
      item.children?.forEach((child) => {
        if (child.label.toLowerCase().includes(q)) {
          results.push({ id: child.id, type: 'page', title: child.label, subtitle: item.label, path: child.path })
        }
      })
    })

    const settingsHits = ['organization', 'profile', 'password', 'users', 'roles', 'branding', 'notifications', 'security', 'api', 'appearance']
    settingsHits.forEach((s) => {
      if (s.includes(q) || `settings ${s}`.includes(q)) {
        results.push({ id: `settings-${s}`, type: 'setting', title: `Settings · ${s}`, path: `/settings?tab=${s}` })
      }
    })

    getCollection(COLLECTION.clients)
      .find({ search: q, searchFields: ['name', 'email', 'pan', 'gstin', 'contactPerson'], pageSize: 6 })
      .forEach((c) => {
        results.push({ id: c.id, type: 'client', title: String(c.name), subtitle: String(c.contactPerson || ''), path: `/clients/${c.id}` })
      })

    getCollection(COLLECTION.invoices)
      .find({ search: q, searchFields: ['invoiceNumber', 'clientName', 'status'], pageSize: 5 })
      .forEach((inv) => {
        results.push({ id: inv.id, type: 'invoice', title: String(inv.invoiceNumber), subtitle: String(inv.clientName), path: `/invoices?q=${encodeURIComponent(String(inv.invoiceNumber))}` })
      })

    getCollection(COLLECTION.payments)
      .find({ search: q, searchFields: ['reference', 'clientName', 'invoiceNumber'], pageSize: 5 })
      .forEach((p) => {
        results.push({ id: p.id, type: 'payment', title: String(p.reference), subtitle: String(p.clientName), path: `/payments?q=${encodeURIComponent(String(p.reference))}` })
      })

    getCollection(COLLECTION.documents)
      .find({ search: q, searchFields: ['name', 'clientName', 'folder', 'tags'], pageSize: 5 })
      .forEach((doc) => {
        results.push({ id: doc.id, type: 'document', title: String(doc.name), subtitle: String(doc.clientName), path: `/documents?q=${encodeURIComponent(String(doc.name))}` })
      })

    getCollection(COLLECTION.employees)
      .find({ search: q, searchFields: ['firstName', 'lastName', 'email'], pageSize: 4 })
      .forEach((emp) => {
        results.push({ id: emp.id, type: 'employee', title: `${emp.firstName} ${emp.lastName}`, subtitle: String(emp.designation), path: '/employees' })
      })

    getCollection(COLLECTION.tasks)
      .find({ search: q, searchFields: ['title', 'clientName'], pageSize: 4 })
      .forEach((task) => {
        results.push({ id: task.id, type: 'task', title: String(task.title), subtitle: String(task.clientName), path: `/tasks?q=${encodeURIComponent(String(task.title))}` })
      })

    getCollection(COLLECTION.companies)
      .find({ search: q, searchFields: ['name', 'cin'], pageSize: 4 })
      .forEach((c) => {
        results.push({ id: c.id, type: 'company', title: String(c.name), subtitle: String(c.industry), path: '/companies' })
      })

    getCollection(COLLECTION.compliance)
      .find({ search: q, searchFields: ['clientName', 'service'], pageSize: 4 })
      .forEach((c) => {
        results.push({ id: c.id, type: 'compliance', title: String(c.service), subtitle: String(c.clientName), path: '/compliance' })
      })

    getCollection(COLLECTION.gst)
      .find({ search: q, searchFields: ['clientName', 'gstin', 'returnType'], pageSize: 3 })
      .forEach((g) => {
        results.push({ id: g.id, type: 'compliance', title: `GST ${g.returnType}`, subtitle: String(g.clientName), path: '/compliance/gst' })
      })

    getCollection(COLLECTION.users)
      .find({ search: q, searchFields: ['fullName', 'email', 'roleName'], pageSize: 3 })
      .forEach((u) => {
        results.push({ id: u.id, type: 'user', title: String(u.fullName || u.email), subtitle: String(u.roleName), path: '/settings?tab=users' })
      })

    return results.slice(0, 25)
  },
}
