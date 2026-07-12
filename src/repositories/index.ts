import { BaseRepository } from './BaseRepository'
import { COLLECTION, getCollection } from '@/db'
import type { Client, Invoice, Payment, Company, Task, Document } from '@/types'

export interface DeleteImpact {
  canHardDelete: boolean
  recommendArchive: boolean
  warnings: string[]
  related: {
    invoices: number
    payments: number
    documents: number
    companies: number
    tasks: number
    compliance: number
  }
}

export class ClientRepository extends BaseRepository<Client> {
  constructor() {
    super(COLLECTION.clients, ['name', 'email', 'pan', 'gstin', 'contactPerson', 'city'])
  }

  getDeleteImpact(clientId: string): DeleteImpact {
    const invoices = getCollection(COLLECTION.invoices).count({ filter: { clientId } })
    const payments = getCollection(COLLECTION.payments).count({ filter: { clientId } })
    const documents = getCollection(COLLECTION.documents).count({ filter: { clientId } })
    const companies = getCollection(COLLECTION.companies).count({ filter: { clientId } })
    const tasks = getCollection(COLLECTION.tasks).count({ filter: { clientId } })
    const compliance = getCollection(COLLECTION.compliance).count({ filter: { clientId } })

    const warnings: string[] = []
    if (invoices) warnings.push(`${invoices} linked invoice(s)`)
    if (payments) warnings.push(`${payments} linked payment(s)`)
    if (documents) warnings.push(`${documents} linked document(s)`)
    if (companies) warnings.push(`${companies} linked compan(ies)`)
    if (tasks) warnings.push(`${tasks} linked task(s)`)
    if (compliance) warnings.push(`${compliance} compliance record(s)`)

    const relatedTotal = invoices + payments + documents + companies + tasks + compliance
    return {
      canHardDelete: relatedTotal === 0,
      recommendArchive: relatedTotal > 0,
      warnings,
      related: { invoices, payments, documents, companies, tasks, compliance },
    }
  }

  /** Soft-delete preferred when relationships exist */
  safeDelete(clientId: string, mode: 'delete' | 'archive' = 'archive'): { mode: string; record: Client | null } {
    const impact = this.getDeleteImpact(clientId)
    if (mode === 'delete' && impact.canHardDelete) {
      this.delete(clientId)
      return { mode: 'deleted', record: null }
    }
    const record = this.archive(clientId)
    return { mode: 'archived', record }
  }

  isDuplicatePan(pan: string, excludeId?: string): boolean {
    return this.findAll().some((c) => c.pan === pan && c.id !== excludeId)
  }

  isDuplicateGstin(gstin: string, excludeId?: string): boolean {
    return this.findAll().some((c) => c.gstin === gstin && c.id !== excludeId)
  }
}

export class InvoiceRepository extends BaseRepository<Invoice> {
  constructor() {
    super(COLLECTION.invoices, ['invoiceNumber', 'clientName', 'status'])
  }

  findByClient(clientId: string) {
    return this.filter({ clientId })
  }
}

export class PaymentRepository extends BaseRepository<Payment> {
  constructor() {
    super(COLLECTION.payments, ['reference', 'clientName', 'invoiceNumber'])
  }
}

export class CompanyRepository extends BaseRepository<Company> {
  constructor() {
    super(COLLECTION.companies, ['name', 'cin', 'industry', 'gstin'])
  }

  getDeleteImpact(companyId: string) {
    const company = this.findById(companyId)
    const roc = getCollection(COLLECTION.roc).count({ filter: { companyId } })
    const warnings: string[] = []
    if (roc) warnings.push(`${roc} ROC filing(s) will remain linked`)
    if (company?.clientId) warnings.push('Client relationship will be preserved on invoices')
    return { warnings, roc }
  }
}

export class TaskRepository extends BaseRepository<Task> {
  constructor() {
    super(COLLECTION.tasks, ['title', 'clientName', 'assignedToName', 'category'])
  }

  reassignFromEmployee(employeeId: string, toEmployeeId: string, toName: string) {
    this.filter({ assignedTo: employeeId }).forEach((task) => {
      this.update(task.id, { assignedTo: toEmployeeId, assignedToName: toName })
    })
  }

  unassignFromEmployee(employeeId: string) {
    this.filter({ assignedTo: employeeId }).forEach((task) => {
      this.update(task.id, { assignedTo: '', assignedToName: 'Unassigned' })
    })
  }
}

export class DocumentRepository extends BaseRepository<Document> {
  constructor() {
    super(COLLECTION.documents, ['name', 'clientName', 'folder', 'type'])
  }
}

export class EmployeeRepository extends BaseRepository<{
  id: string
  firstName: string
  lastName: string
  email: string
  archived?: boolean
}> {
  constructor() {
    super(COLLECTION.employees, ['firstName', 'lastName', 'email', 'designation', 'department'])
  }

  getAssignedTaskCount(employeeId: string) {
    return getCollection(COLLECTION.tasks).count({ filter: { assignedTo: employeeId } })
  }
}

export class SettingsRepository {
  get() {
    const row = getCollection(COLLECTION.settings).findById('SETTINGS-001')
    return row
  }

  update(section: string, data: Record<string, unknown> | unknown[]) {
    const current = getCollection(COLLECTION.settings).findById('SETTINGS-001') || { id: 'SETTINGS-001' }
    const existing = (current as Record<string, unknown>)[section]
    const merged = Array.isArray(data)
      ? data
      : { ...((typeof existing === 'object' && existing && !Array.isArray(existing) ? existing : {}) as object), ...data }
    return getCollection(COLLECTION.settings).update('SETTINGS-001', {
      ...current,
      [section]: merged,
    })
  }

  updateOrganization(data: Record<string, unknown>) {
    return getCollection(COLLECTION.organization).update('ORG-001', data)
  }
}

export class NotificationRepository extends BaseRepository<{
  id: string
  title: string
  message: string
  read?: boolean
  archived?: boolean
}> {
  constructor() {
    super(COLLECTION.notifications, ['title', 'message'])
  }
}

export const clientRepository = new ClientRepository()
export const invoiceRepository = new InvoiceRepository()
export const paymentRepository = new PaymentRepository()
export const companyRepository = new CompanyRepository()
export const taskRepository = new TaskRepository()
export const documentRepository = new DocumentRepository()
export const employeeRepository = new EmployeeRepository()
export const settingsRepository = new SettingsRepository()
export const notificationRepository = new NotificationRepository()
