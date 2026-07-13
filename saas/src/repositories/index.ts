import { BaseRepository } from './BaseRepository'
import { http, type PaginatedResult } from '@/services/httpClient'
import type { Client, Invoice, Payment, Company, Task, Document } from '@/types'

export type { Entity } from './BaseRepository'
export { BaseRepository } from './BaseRepository'

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
    super('clients', ['name', 'email', 'pan', 'gstin', 'contactPerson', 'city'])
  }

  async getDeleteImpact(clientId: string): Promise<DeleteImpact> {
    const [invoices, payments, documents, companies, tasks, compliance] = await Promise.all([
      new InvoiceRepository().count({ clientId }),
      new PaymentRepository().count({ clientId }),
      new DocumentRepository().count({ clientId }),
      new CompanyRepository().count({ clientId }),
      new TaskRepository().count({ clientId }),
      http
        .get<PaginatedResult<{ clientId?: string }>>('/compliance', {
          params: { page: 1, pageSize: 100000 },
        })
        .then((r) => r.data.filter((row) => row.clientId === clientId).length),
    ])

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

  async isDuplicatePan(pan: string, excludeId?: string): Promise<boolean> {
    const all = await this.findAll()
    return all.some((c) => c.pan === pan && c.id !== excludeId)
  }

  async isDuplicateGstin(gstin: string, excludeId?: string): Promise<boolean> {
    const all = await this.findAll()
    return all.some((c) => c.gstin === gstin && c.id !== excludeId)
  }
}

export class InvoiceRepository extends BaseRepository<Invoice> {
  constructor() {
    super('invoices', ['invoiceNumber', 'clientName', 'status'])
  }

  async findByClient(clientId: string) {
    return this.filter({ clientId })
  }
}

export class PaymentRepository extends BaseRepository<Payment> {
  constructor() {
    super('payments', ['reference', 'clientName', 'invoiceNumber'])
  }
}

export class CompanyRepository extends BaseRepository<Company> {
  constructor() {
    super('companies', ['name', 'cin', 'industry', 'gstin'])
  }

  async getDeleteImpact(companyId: string) {
    const company = await this.findById(companyId)
    const rocRes = await http.get<PaginatedResult<{ companyId?: string }>>('/roc', {
      params: { page: 1, pageSize: 100000 },
    })
    const roc = rocRes.data.filter((r) => r.companyId === companyId).length
    const warnings: string[] = []
    if (roc) warnings.push(`${roc} ROC filing(s) will remain linked`)
    if (company?.clientId) warnings.push('Client relationship will be preserved on invoices')
    return { warnings, roc }
  }
}

export class TaskRepository extends BaseRepository<Task> {
  constructor() {
    super('tasks', ['title', 'clientName', 'assignedToName', 'category'])
  }

  async reassignFromEmployee(employeeId: string, toEmployeeId: string, toName: string) {
    const tasks = await this.filter({ assignedTo: employeeId })
    await Promise.all(
      tasks.map((task) => this.update(task.id, { assignedTo: toEmployeeId, assignedToName: toName })),
    )
  }

  async unassignFromEmployee(employeeId: string) {
    const tasks = await this.filter({ assignedTo: employeeId })
    await Promise.all(
      tasks.map((task) => this.update(task.id, { assignedTo: '', assignedToName: 'Unassigned' })),
    )
  }
}

export class DocumentRepository extends BaseRepository<Document> {
  constructor() {
    super('documents', ['name', 'clientName', 'folder', 'type'])
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
    super('employees', ['firstName', 'lastName', 'email', 'designation', 'department'])
  }

  async getAssignedTaskCount(employeeId: string) {
    return new TaskRepository().count({ assignedTo: employeeId })
  }
}

export class SettingsRepository {
  async get() {
    return http.get<Record<string, unknown>>('/settings')
  }

  async update(section: string, data: Record<string, unknown> | unknown[]) {
    const current = await this.get()
    const existing = current[section]
    const merged = Array.isArray(data)
      ? data
      : {
          ...((typeof existing === 'object' && existing && !Array.isArray(existing)
            ? existing
            : {}) as object),
          ...data,
        }
    return http.patch('/settings', { [section]: merged })
  }

  async updateOrganization(data: Record<string, unknown>) {
    return http.patch('/settings/organization', data)
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
    super('notifications', ['title', 'message'])
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
