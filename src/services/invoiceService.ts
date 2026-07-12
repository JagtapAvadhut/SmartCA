import { createCrudService } from './crudFactory'
import { COLLECTION, getCollection } from '@/db'
import { simulateDelay } from './api'
import { recalcClientFinancials, logActivity, syncInvoiceFromPayments } from './relations'
import { withTransactionAsync } from '@/utils/transaction'
import { computeInvoiceTax, invoiceRemaining, roundMoney } from '@/utils/money'
import type { Invoice, Payment } from '@/types'

function buildTotals(data: Partial<Invoice>) {
  const subtotal = roundMoney(Number(data.subtotal || 0))
  // Allow exact totals when caller supplies a complete tax breakdown (demo / QA / interstate)
  if (
    data.total != null &&
    (data.cgst != null || data.sgst != null || data.igst != null) &&
    Number(data.total) > 0
  ) {
    const total = roundMoney(Number(data.total))
    return {
      subtotal,
      discount: roundMoney(Number(data.discount || 0)),
      roundOff: roundMoney(Number(data.roundOff || 0)),
      cgst: roundMoney(Number(data.cgst || 0)),
      sgst: roundMoney(Number(data.sgst || 0)),
      igst: roundMoney(Number(data.igst || 0)),
      total,
      remainingAmount: invoiceRemaining(total, Number(data.paidAmount || 0)),
    }
  }
  const useIgst = Number(data.igst || 0) > 0 && Number(data.cgst || 0) === 0 && Number(data.sgst || 0) === 0
  const computed = computeInvoiceTax(subtotal, {
    discount: data.discount,
    roundOff: data.roundOff,
    igst: useIgst,
  })
  return {
    subtotal,
    discount: computed.discount,
    roundOff: computed.roundOff,
    cgst: computed.cgst,
    sgst: computed.sgst,
    igst: computed.igst,
    total: computed.total,
    remainingAmount: invoiceRemaining(computed.total, Number(data.paidAmount || 0)),
  }
}

const base = createCrudService<Invoice>(COLLECTION.invoices, {
  searchFields: ['invoiceNumber', 'clientName', 'status'],
  beforeCreate: (data) => {
    const amount = data.subtotal || 0
    const totals = buildTotals({ ...data, subtotal: amount })
    const paidAmount = Number(data.paidAmount || 0)
    return {
      invoiceNumber: `SCA/2025-26/${Date.now().toString().slice(-4)}`,
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      status: 'draft',
      items: data.items || [{ description: 'Professional fees', quantity: 1, rate: amount, amount }],
      notes: 'Professional fees for CA services rendered.',
      createdBy: '',
      ...data,
      ...totals,
      paidAmount,
      remainingAmount: invoiceRemaining(totals.total, paidAmount),
    }
  },
})

export const InvoiceService = {
  ...base,
  computeTotals: buildTotals,
  async create(data: Partial<Invoice>) {
    return withTransactionAsync(async () => {
      const inv = await base.create(data)
      if (inv.clientId) recalcClientFinancials(inv.clientId)
      logActivity({
        type: 'invoice_created',
        message: `Invoice ${inv.invoiceNumber} created for ${inv.clientName || 'client'}`,
        clientId: inv.clientId,
        clientName: inv.clientName,
      })
      return inv
    }, [COLLECTION.invoices, COLLECTION.clients, COLLECTION.activities])
  },
  async update(id: string, data: Partial<Invoice>) {
    return withTransactionAsync(async () => {
      const before = getCollection<Invoice>(COLLECTION.invoices).findById(id)
      if (!before) throw new Error('Invoice not found')

      const merged = { ...before, ...data }
      const totals =
        data.subtotal != null || data.discount != null || data.roundOff != null || data.igst != null
          ? buildTotals(merged)
          : null

      const inv = await base.update(id, totals ? { ...data, ...totals } : data)

      // Always resync paidAmount from payments after structural edits
      syncInvoiceFromPayments(inv.id)

      if (before.clientId && before.clientId !== inv.clientId) {
        recalcClientFinancials(before.clientId)
      }
      if (inv.clientId) recalcClientFinancials(inv.clientId)
      return getCollection<Invoice>(COLLECTION.invoices).findById(id)!
    }, [COLLECTION.invoices, COLLECTION.clients, COLLECTION.payments])
  },
  async delete(id: string) {
    return withTransactionAsync(async () => {
      const before = getCollection<Invoice>(COLLECTION.invoices).findById(id)
      if (!before) return { success: false }

      // Remove linked payments to avoid orphans, then recalc client
      const payments = getCollection<Payment>(COLLECTION.payments)
        .find({ filter: { invoiceId: id }, pageSize: 100000 })
      payments.forEach((p) => getCollection<Payment>(COLLECTION.payments).delete(p.id))

      const result = await base.delete(id)
      if (before.clientId) recalcClientFinancials(before.clientId)
      return result
    }, [COLLECTION.invoices, COLLECTION.payments, COLLECTION.clients])
  },
  async duplicate(id: string) {
    return withTransactionAsync(async () => {
      const source = getCollection<Invoice>(COLLECTION.invoices).findById(id)
      if (!source) throw new Error('Invoice not found')
      const copy = await base.duplicate(id, {
        invoiceNumber: `SCA/2025-26/${Date.now().toString().slice(-4)}`,
        status: 'draft',
        paidAmount: 0,
        remainingAmount: source.total,
      })
      if (copy.clientId) recalcClientFinancials(copy.clientId)
      return copy
    }, [COLLECTION.invoices, COLLECTION.clients])
  },
  async getByClient(clientId: string) {
    await simulateDelay()
    return getCollection<Invoice>(COLLECTION.invoices).find({ filter: { clientId } })
  },
  async getStats() {
    await simulateDelay()
    const all = getCollection<Invoice>(COLLECTION.invoices).find()
    return {
      total: all.length,
      paid: all.filter((i) => i.status === 'paid').length,
      overdue: all.filter((i) => i.status === 'overdue').length,
      totalAmount: all.reduce((s, i) => s + (i.total || 0), 0),
      paidAmount: all.filter((i) => i.status === 'paid').reduce((s, i) => s + i.total, 0),
    }
  },
}
