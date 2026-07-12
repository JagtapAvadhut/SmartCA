import { createCrudService } from './crudFactory'
import { COLLECTION, getCollection } from '@/db'
import { simulateDelay } from './api'
import {
  syncPaymentSideEffects,
  logActivity,
  validatePaymentAmount,
  recalcClientFinancials,
  syncInvoiceFromPayments,
} from './relations'
import { withTransactionAsync } from '@/utils/transaction'
import { roundMoney } from '@/utils/money'
import type { Payment } from '@/types'

const base = createCrudService<Payment>(COLLECTION.payments, {
  searchFields: ['reference', 'clientName', 'invoiceNumber', 'method'],
  beforeCreate: (data) => ({
    paymentDate: new Date().toISOString().split('T')[0],
    method: 'bank_transfer',
    status: 'completed',
    notes: '',
    reference: `TXN${Date.now()}`,
    recordedBy: '',
    ...data,
    amount: roundMoney(Number(data.amount || 0)),
  }),
})

function assertValidPayment(data: Partial<Payment>, excludePaymentId?: string) {
  const amount = Number(data.amount)
  const invoiceId = String(data.invoiceId || '')
  if (!invoiceId) throw new Error('Invoice is required')
  const check = validatePaymentAmount(amount, invoiceId, { excludePaymentId })
  if (!check.ok) throw new Error(check.message)

  // Duplicate reference prevention (same invoice + same reference)
  const ref = String(data.reference || '').trim()
  if (ref) {
    const dup = getCollection<Payment>(COLLECTION.payments)
      .find({ pageSize: 100000 })
      .find(
        (p) =>
          p.id !== excludePaymentId &&
          p.invoiceId === invoiceId &&
          String(p.reference || '').trim().toLowerCase() === ref.toLowerCase() &&
          p.status === 'completed',
      )
    if (dup) throw new Error(`Duplicate payment reference "${ref}" for this invoice`)
  }
}

export const PaymentService = {
  ...base,
  async create(data: Partial<Payment>) {
    return withTransactionAsync(async () => {
      assertValidPayment(data)
      const payment = await base.create(data)
      syncPaymentSideEffects(payment)
      logActivity({
        type: 'payment_received',
        message: `Payment ${payment.reference} recorded for ${payment.clientName || 'client'}`,
        clientId: payment.clientId,
        clientName: payment.clientName,
      })
      return payment
    }, [COLLECTION.payments, COLLECTION.invoices, COLLECTION.clients, COLLECTION.activities])
  },
  async update(id: string, data: Partial<Payment>) {
    return withTransactionAsync(async () => {
      const before = getCollection<Payment>(COLLECTION.payments).findById(id)
      if (!before) throw new Error('Payment not found')
      const next = { ...before, ...data }
      assertValidPayment(next, id)
      const payment = await base.update(id, { ...data, amount: data.amount != null ? roundMoney(Number(data.amount)) : undefined })
      // Recalc old invoice (if moved) and new invoice
      if (before.invoiceId && before.invoiceId !== payment.invoiceId) {
        syncInvoiceFromPayments(before.invoiceId)
        if (before.clientId) recalcClientFinancials(before.clientId)
      }
      syncPaymentSideEffects(payment)
      return payment
    }, [COLLECTION.payments, COLLECTION.invoices, COLLECTION.clients])
  },
  async delete(id: string) {
    return withTransactionAsync(async () => {
      const before = getCollection<Payment>(COLLECTION.payments).findById(id)
      const result = await base.delete(id)
      if (before) syncPaymentSideEffects(before)
      return result
    }, [COLLECTION.payments, COLLECTION.invoices, COLLECTION.clients])
  },
  async getByClient(clientId: string) {
    await simulateDelay()
    return getCollection<Payment>(COLLECTION.payments).find({ filter: { clientId } })
  },
  async getStats() {
    await simulateDelay()
    const all = getCollection<Payment>(COLLECTION.payments).find()
    return {
      total: all.length,
      completed: all.filter((p) => p.status === 'completed').length,
      totalAmount: all.filter((p) => p.status === 'completed').reduce((s, p) => s + p.amount, 0),
    }
  },
}
