import { COLLECTION, getCollection } from '@/db'
import type { Invoice, Client, Payment } from '@/types'
import { invoiceRemaining, isOutstandingStatus, roundMoney } from '@/utils/money'

export type InvoiceDerivedStatus = 'draft' | 'sent' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled'

/** Derive invoice status from paidAmount vs total (never invent paid without money). */
export function deriveInvoiceStatus(
  invoice: Pick<Invoice, 'status' | 'dueDate' | 'total' | 'paidAmount'>,
  paidAmount: number,
): InvoiceDerivedStatus {
  const current = String(invoice.status || 'draft') as InvoiceDerivedStatus
  if (current === 'cancelled' || current === 'draft') return current

  const total = roundMoney(Number(invoice.total || 0))
  const paid = roundMoney(paidAmount)

  if (paid <= 0) {
    const due = invoice.dueDate ? new Date(invoice.dueDate) : null
    if (due && !Number.isNaN(due.getTime()) && due.getTime() < Date.now()) return 'overdue'
    return 'sent'
  }
  if (paid >= total && total > 0) return 'paid'
  return 'partially_paid'
}

/** Recalculate invoice paidAmount + status from linked completed payments */
export function syncInvoiceFromPayments(invoiceId: string) {
  if (!invoiceId) return null
  const invoices = getCollection<Invoice>(COLLECTION.invoices)
  const invoice = invoices.findById(invoiceId)
  if (!invoice) return null

  const payments = getCollection<Payment>(COLLECTION.payments)
    .find({ filter: { invoiceId }, pageSize: 100000 })
    .filter((p) => p.status === 'completed')

  const paidAmount = roundMoney(payments.reduce((s, p) => s + Number(p.amount || 0), 0))
  const status = deriveInvoiceStatus(invoice, paidAmount)
  const remainingAmount = invoiceRemaining(Number(invoice.total || 0), paidAmount)

  return invoices.update(invoiceId, { paidAmount, status, remainingAmount })
}

/** Recalculate client revenue + outstanding from invoices */
export function recalcClientFinancials(clientId: string) {
  if (!clientId) return null
  const clients = getCollection<Client>(COLLECTION.clients)
  const client = clients.findById(clientId)
  if (!client) return null

  const invoices = getCollection<Invoice>(COLLECTION.invoices)
    .find({ filter: { clientId }, pageSize: 100000 })

  const revenue = roundMoney(
    invoices
      .filter((i) => i.status === 'paid')
      .reduce((s, i) => s + Number(i.total || 0), 0),
  )

  const outstanding = roundMoney(
    invoices
      .filter((i) => isOutstandingStatus(String(i.status)))
      .reduce((s, i) => s + invoiceRemaining(Number(i.total || 0), Number(i.paidAmount || 0)), 0),
  )

  return clients.update(clientId, { revenue, outstanding })
}

export function syncPaymentSideEffects(payment: { invoiceId?: string; clientId?: string }) {
  const touchedClients = new Set<string>()

  if (payment.invoiceId) {
    const inv = syncInvoiceFromPayments(payment.invoiceId)
    const clientId = payment.clientId || inv?.clientId
    if (clientId) touchedClients.add(clientId)
  } else if (payment.clientId) {
    touchedClients.add(payment.clientId)
  }

  touchedClients.forEach((id) => recalcClientFinancials(id))
}

/** Remaining balance on an invoice excluding a specific payment (for edits). */
export function getInvoiceRemainingBalance(invoiceId: string, excludePaymentId?: string): number {
  const invoice = getCollection<Invoice>(COLLECTION.invoices).findById(invoiceId)
  if (!invoice) return 0
  const paid = getCollection<Payment>(COLLECTION.payments)
    .find({ filter: { invoiceId }, pageSize: 100000 })
    .filter((p) => p.status === 'completed' && p.id !== excludePaymentId)
    .reduce((s, p) => s + Number(p.amount || 0), 0)
  return invoiceRemaining(Number(invoice.total || 0), paid)
}

export function validatePaymentAmount(
  amount: number,
  invoiceId: string,
  opts?: { excludePaymentId?: string; allowOverpay?: boolean },
): { ok: true } | { ok: false; message: string } {
  const amt = Number(amount)
  if (!Number.isFinite(amt) || amt <= 0) {
    return { ok: false, message: 'Payment amount must be greater than zero' }
  }
  if (amt < 0) {
    return { ok: false, message: 'Payment amount cannot be negative' }
  }
  const remaining = getInvoiceRemainingBalance(invoiceId, opts?.excludePaymentId)
  if (!opts?.allowOverpay && amt > remaining + 0.001) {
    return {
      ok: false,
      message: `Payment ₹${amt} exceeds remaining invoice balance ₹${remaining}`,
    }
  }
  return { ok: true }
}

export function logActivity(input: {
  type: string
  message: string
  clientId?: string
  clientName?: string
  userId?: string
  userName?: string
}) {
  return getCollection(COLLECTION.activities).insert({
    type: input.type,
    message: input.message,
    clientId: input.clientId || '',
    clientName: input.clientName || '',
    userId: input.userId || '',
    userName: input.userName || 'System',
    timestamp: new Date().toISOString(),
  })
}

export function pushNotification(input: { title: string; message: string; type?: string; link?: string }) {
  return getCollection(COLLECTION.notifications).insert({
    title: input.title,
    message: input.message,
    type: input.type || 'info',
    read: false,
    createdAt: new Date().toISOString(),
    link: input.link || '/',
  })
}
