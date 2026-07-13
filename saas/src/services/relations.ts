import type { Invoice } from '@/types'
import { roundMoney } from '@/utils/money'

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

/**
 * Backend owns invoice/payment side effects.
 * These stubs remain so older call sites compile; they are no-ops.
 */
export function syncInvoiceFromPayments(_invoiceId: string): null {
  return null
}

export function recalcClientFinancials(_clientId: string): null {
  return null
}

export function syncPaymentSideEffects(_payment: unknown): void {
  /* backend */
}

export function validatePaymentAmount(
  amount: number,
  _invoiceId: string,
  _opts?: { excludePaymentId?: string },
): { ok: boolean; message: string } {
  if (!(amount > 0)) return { ok: false, message: 'Amount must be greater than zero' }
  return { ok: true, message: '' }
}

export function logActivity(_input: {
  type: string
  message: string
  clientId?: string
  clientName?: string
}): void {
  /* backend logs activities on mutations */
}

export function notify(_input: unknown): void {
  /* no-op */
}
