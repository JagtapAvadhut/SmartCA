import { COLLECTION, getCollection } from '@/db'
import type { Client, Invoice, Payment, Task, Document, ComplianceRecord } from '@/types'
import { invoiceRemaining, isOutstandingStatus, roundMoney } from '@/utils/money'
import { syncInvoiceFromPayments, recalcClientFinancials } from './relations'
import { computeDashboard } from './analyticsService'

export interface IntegrityIssue {
  id: string
  severity: 'error' | 'warning'
  category: string
  message: string
  entityType?: string
  entityId?: string
  expected?: number | string
  actual?: number | string
}

export interface IntegrityReport {
  checkedAt: string
  issueCount: number
  errorCount: number
  warningCount: number
  issues: IntegrityIssue[]
}

const AUDIT_KEY = 'smart-ca-db:integrity-audit'

function invoiceBalance(inv: Invoice) {
  return invoiceRemaining(Number(inv.total || 0), Number(inv.paidAmount || 0))
}

function pushIssue(list: IntegrityIssue[], issue: Omit<IntegrityIssue, 'id'>) {
  list.push({ ...issue, id: `ISSUE-${list.length + 1}` })
}

export function runDataIntegrityCheck(): IntegrityReport {
  const issues: IntegrityIssue[] = []
  const clients = getCollection<Client>(COLLECTION.clients).find({ pageSize: 100000 })
  const invoices = getCollection<Invoice>(COLLECTION.invoices).find({ pageSize: 100000 })
  const payments = getCollection<Payment>(COLLECTION.payments).find({ pageSize: 100000 })
  const tasks = getCollection<Task>(COLLECTION.tasks).find({ pageSize: 100000 })
  const documents = getCollection<Document>(COLLECTION.documents).find({ pageSize: 100000 })
  const compliance = getCollection<ComplianceRecord>(COLLECTION.compliance).find({ pageSize: 100000 })
  const users = getCollection(COLLECTION.users).find({ pageSize: 100000 })
  const roles = getCollection(COLLECTION.roles).find({ pageSize: 100000 })
  const employees = getCollection(COLLECTION.employees).find({ pageSize: 100000 })

  const clientIds = new Set(clients.map((c) => c.id))
  const invoiceIds = new Set(invoices.map((i) => i.id))
  const roleIds = new Set(roles.map((r) => r.id))
  const employeeIds = new Set(employees.map((e) => e.id))

  ;[
    ['clients', clients] as const,
    ['invoices', invoices] as const,
    ['payments', payments] as const,
  ].forEach(([name, rows]) => {
    const seen = new Set<string>()
    rows.forEach((r) => {
      if (seen.has(r.id)) {
        pushIssue(issues, {
          severity: 'error',
          category: 'duplicate_id',
          message: `Duplicate ${name} id ${r.id}`,
          entityType: name,
          entityId: r.id,
        })
      }
      seen.add(r.id)
    })
  })

  invoices.forEach((inv) => {
    const paid = roundMoney(
      payments
        .filter((p) => p.invoiceId === inv.id && p.status === 'completed')
        .reduce((s, p) => s + Number(p.amount || 0), 0),
    )
    if (roundMoney(Number(inv.paidAmount || 0)) !== paid) {
      pushIssue(issues, {
        severity: 'error',
        category: 'invoice_paid_mismatch',
        message: `Invoice ${inv.invoiceNumber} paidAmount mismatch`,
        entityType: 'invoice',
        entityId: inv.id,
        expected: paid,
        actual: inv.paidAmount,
      })
    }
    const remaining = invoiceRemaining(Number(inv.total || 0), paid)
    if (inv.remainingAmount != null && roundMoney(Number(inv.remainingAmount)) !== remaining) {
      pushIssue(issues, {
        severity: 'warning',
        category: 'invoice_remaining_mismatch',
        message: `Invoice ${inv.invoiceNumber} remainingAmount stale`,
        entityType: 'invoice',
        entityId: inv.id,
        expected: remaining,
        actual: inv.remainingAmount,
      })
    }
    if (!clientIds.has(inv.clientId)) {
      pushIssue(issues, {
        severity: 'error',
        category: 'orphan_invoice',
        message: `Invoice ${inv.invoiceNumber} references missing client ${inv.clientId}`,
        entityType: 'invoice',
        entityId: inv.id,
      })
    }
  })

  clients.forEach((c) => {
    const expected = roundMoney(
      invoices
        .filter((i) => i.clientId === c.id && isOutstandingStatus(String(i.status)))
        .reduce((s, i) => s + invoiceBalance(i), 0),
    )
    if (roundMoney(Number(c.outstanding || 0)) !== expected) {
      pushIssue(issues, {
        severity: 'error',
        category: 'client_outstanding_mismatch',
        message: `Client ${c.name} outstanding mismatch`,
        entityType: 'client',
        entityId: c.id,
        expected,
        actual: c.outstanding,
      })
    }
  })

  payments.forEach((p) => {
    if (p.invoiceId && !invoiceIds.has(p.invoiceId)) {
      pushIssue(issues, {
        severity: 'error',
        category: 'orphan_payment',
        message: `Payment ${p.reference} references missing invoice ${p.invoiceId}`,
        entityType: 'payment',
        entityId: p.id,
      })
    }
    if (p.clientId && !clientIds.has(p.clientId)) {
      pushIssue(issues, {
        severity: 'error',
        category: 'orphan_payment_client',
        message: `Payment ${p.reference} references missing client ${p.clientId}`,
        entityType: 'payment',
        entityId: p.id,
      })
    }
  })

  tasks.forEach((t) => {
    if (t.clientId && !clientIds.has(t.clientId)) {
      pushIssue(issues, {
        severity: 'error',
        category: 'orphan_task',
        message: `Task "${t.title}" references missing client`,
        entityType: 'task',
        entityId: t.id,
      })
    }
    if (t.assignedTo && t.assignedTo !== '' && !employeeIds.has(t.assignedTo)) {
      pushIssue(issues, {
        severity: 'warning',
        category: 'invalid_employee_assignment',
        message: `Task "${t.title}" assigned to missing employee ${t.assignedTo}`,
        entityType: 'task',
        entityId: t.id,
      })
    }
  })

  documents.forEach((d) => {
    if (d.clientId && !clientIds.has(d.clientId)) {
      pushIssue(issues, {
        severity: 'error',
        category: 'orphan_document',
        message: `Document "${d.name}" references missing client`,
        entityType: 'document',
        entityId: d.id,
      })
    }
  })

  compliance.forEach((c) => {
    if (c.clientId && !clientIds.has(c.clientId)) {
      pushIssue(issues, {
        severity: 'error',
        category: 'orphan_compliance',
        message: `Compliance "${c.service || c.description || c.id}" references missing client`,
        entityType: 'compliance',
        entityId: c.id,
      })
    }
  })

  users.forEach((u) => {
    const role = String((u as { role?: string }).role || '')
    if (role && !roleIds.has(role)) {
      pushIssue(issues, {
        severity: 'warning',
        category: 'invalid_role_reference',
        message: `User ${(u as { email?: string }).email} has invalid role ${role}`,
        entityType: 'user',
        entityId: u.id,
      })
    }
  })

  const dash = computeDashboard()
  const expectedOutstanding = roundMoney(
    invoices.filter((i) => isOutstandingStatus(String(i.status))).reduce((s, i) => s + invoiceBalance(i), 0),
  )
  if (roundMoney(Number(dash.kpis.outstanding.value)) !== expectedOutstanding) {
    pushIssue(issues, {
      severity: 'error',
      category: 'dashboard_outstanding_mismatch',
      message: 'Dashboard outstanding KPI mismatch vs invoices',
      expected: expectedOutstanding,
      actual: dash.kpis.outstanding.value,
    })
  }

  const errorCount = issues.filter((i) => i.severity === 'error').length
  const warningCount = issues.filter((i) => i.severity === 'warning').length

  return {
    checkedAt: new Date().toISOString(),
    issueCount: issues.length,
    errorCount,
    warningCount,
    issues,
  }
}

export function repairDerivedData(): { repaired: number; report: IntegrityReport; auditId: string } {
  const invoices = getCollection<Invoice>(COLLECTION.invoices).find({ pageSize: 100000 })
  const clients = getCollection<Client>(COLLECTION.clients).find({ pageSize: 100000 })
  let repaired = 0

  invoices.forEach((inv) => {
    syncInvoiceFromPayments(inv.id)
    repaired += 1
  })
  clients.forEach((c) => {
    recalcClientFinancials(c.id)
    repaired += 1
  })

  const report = runDataIntegrityCheck()
  const audit = {
    id: `AUDIT-${Date.now()}`,
    action: 'repair_derived_data',
    repaired,
    errorCount: report.errorCount,
    warningCount: report.warningCount,
    at: new Date().toISOString(),
  }
  try {
    const prev = JSON.parse(localStorage.getItem(AUDIT_KEY) || '[]') as unknown[]
    prev.unshift(audit)
    localStorage.setItem(AUDIT_KEY, JSON.stringify(prev.slice(0, 50)))
  } catch {
    /* ignore */
  }

  return { repaired, report, auditId: audit.id }
}

export function getIntegrityAuditLog() {
  try {
    return JSON.parse(localStorage.getItem(AUDIT_KEY) || '[]') as Array<Record<string, unknown>>
  } catch {
    return []
  }
}
