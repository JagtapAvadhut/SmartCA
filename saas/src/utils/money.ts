/** Money helpers — all amounts in INR rupees (whole rupees after round). */

export function roundMoney(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100
}

/** GST formula used across the app: 18% on subtotal, split equally CGST/SGST. */
export function computeInvoiceTax(subtotal: number, opts?: { igst?: boolean; discount?: number; roundOff?: number }) {
  const discount = roundMoney(opts?.discount || 0)
  const taxable = Math.max(0, roundMoney(subtotal) - discount)
  const tax = Math.round(taxable * 0.18)
  const igst = !!opts?.igst
  const cgst = igst ? 0 : tax / 2
  const sgst = igst ? 0 : tax / 2
  const igstAmt = igst ? tax : 0
  const roundOff = roundMoney(opts?.roundOff || 0)
  const total = roundMoney(taxable + tax + roundOff)
  return { taxable, cgst, sgst, igst: igstAmt, tax, total, discount, roundOff }
}

export function invoiceRemaining(total: number, paidAmount: number): number {
  return Math.max(0, roundMoney(Number(total) || 0) - roundMoney(Number(paidAmount) || 0))
}

/** Statuses that contribute to outstanding balances */
export const OUTSTANDING_STATUSES = new Set(['sent', 'partially_paid', 'overdue'])

export function isOutstandingStatus(status: string): boolean {
  return OUTSTANDING_STATUSES.has(String(status))
}
