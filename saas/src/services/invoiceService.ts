import { createCrudService } from './crudFactory'
import { computeInvoiceTax, invoiceRemaining, roundMoney } from '@/utils/money'
import type { Invoice } from '@/types'

function buildTotals(data: Partial<Invoice>) {
  const subtotal = roundMoney(Number(data.subtotal || 0))
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

const base = createCrudService<Invoice>('invoices', {
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
    return base.create(data)
  },
  async update(id: string, data: Partial<Invoice>) {
    const before = await base.getById(id)
    const merged = { ...before, ...data }
    const totals =
      data.subtotal != null || data.discount != null || data.roundOff != null || data.igst != null
        ? buildTotals(merged)
        : null
    return base.update(id, totals ? { ...data, ...totals } : data)
  },
  async delete(id: string) {
    return base.delete(id)
  },
  async duplicate(id: string) {
    const source = await base.getById(id)
    return base.duplicate(id, {
      invoiceNumber: `SCA/2025-26/${Date.now().toString().slice(-4)}`,
      status: 'draft',
      paidAmount: 0,
      remainingAmount: source.total,
    } as Partial<Invoice>)
  },
  async getByClient(clientId: string) {
    return base.find({ clientId })
  },
  async getStats() {
    const all = await base.find()
    return {
      total: all.length,
      paid: all.filter((i) => i.status === 'paid').length,
      overdue: all.filter((i) => i.status === 'overdue').length,
      totalAmount: all.reduce((s, i) => s + (i.total || 0), 0),
      paidAmount: all.filter((i) => i.status === 'paid').reduce((s, i) => s + i.total, 0),
    }
  },
}
