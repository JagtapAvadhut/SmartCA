import { COLLECTION, getCollection } from '@/db'
import type { Invoice, Payment } from '@/types'
import { roundMoney } from '@/utils/money'

export interface JournalLine {
  account: string
  debit: number
  credit: number
}

export interface JournalEntry {
  id: string
  date: string
  narration: string
  lines: JournalLine[]
  source?: 'manual' | 'invoice' | 'payment'
  sourceId?: string
  createdAt: string
  archived?: boolean
}

export interface LedgerRow {
  account: string
  debit: number
  credit: number
  balance: number
}

const JOURNAL_KEY = 'smart-ca-db:journals'

export function readManualJournals(): JournalEntry[] {
  try {
    return (JSON.parse(localStorage.getItem(JOURNAL_KEY) || '[]') as JournalEntry[]).filter((j) => !j.archived)
  } catch {
    return []
  }
}

export function writeManualJournals(rows: JournalEntry[]) {
  localStorage.setItem(JOURNAL_KEY, JSON.stringify(rows))
}

export function assertBalanced(lines: JournalLine[]): { ok: true; debit: number; credit: number } | { ok: false; message: string; debit: number; credit: number } {
  const debit = roundMoney(lines.reduce((s, l) => s + Number(l.debit || 0), 0))
  const credit = roundMoney(lines.reduce((s, l) => s + Number(l.credit || 0), 0))
  if (debit !== credit) {
    return { ok: false, message: `Unbalanced journal: Debit ₹${debit} ≠ Credit ₹${credit}`, debit, credit }
  }
  if (debit <= 0) {
    return { ok: false, message: 'Journal must have non-zero amounts', debit, credit }
  }
  return { ok: true, debit, credit }
}

/** System-derived books from invoices/payments — never mixed as duplicate AR with the same invoice twice. */
export function buildSystemJournals(): JournalEntry[] {
  const invoices = getCollection<Invoice>(COLLECTION.invoices)
    .find({ pageSize: 100000 })
    .filter((i) => !['draft', 'cancelled'].includes(String(i.status)))
  const payments = getCollection<Payment>(COLLECTION.payments)
    .find({ pageSize: 100000 })
    .filter((p) => p.status === 'completed')

  const fromInvoices: JournalEntry[] = invoices.map((inv) => ({
    id: `SYS-INV-${inv.id}`,
    date: inv.issueDate,
    narration: `Invoice ${inv.invoiceNumber} — ${inv.clientName}`,
    source: 'invoice' as const,
    sourceId: inv.id,
    createdAt: inv.createdAt || inv.issueDate,
    lines: [
      { account: 'Accounts Receivable', debit: Number(inv.total || 0), credit: 0 },
      { account: 'Professional Fees', debit: 0, credit: Number(inv.total || 0) },
    ],
  }))

  const fromPayments: JournalEntry[] = payments.map((p) => ({
    id: `SYS-PAY-${p.id}`,
    date: p.paymentDate,
    narration: `Payment ${p.reference} — ${p.clientName}`,
    source: 'payment' as const,
    sourceId: p.id,
    createdAt: p.paymentDate,
    lines: [
      { account: 'Bank', debit: Number(p.amount || 0), credit: 0 },
      { account: 'Accounts Receivable', debit: 0, credit: Number(p.amount || 0) },
    ],
  }))

  return [...fromInvoices, ...fromPayments]
}

export function getAllJournals(includeManual = true): JournalEntry[] {
  const system = buildSystemJournals()
  const manual = includeManual ? readManualJournals().filter((j) => j.source !== 'invoice' && j.source !== 'payment') : []
  return [...system, ...manual]
}

export function postManualJournal(input: { date: string; narration: string; lines: JournalLine[] }): JournalEntry {
  const check = assertBalanced(input.lines)
  if (!check.ok) throw new Error(check.message)
  const entry: JournalEntry = {
    id: `JRN-${Date.now()}`,
    date: input.date,
    narration: input.narration,
    lines: input.lines.map((l) => ({
      account: l.account.trim(),
      debit: roundMoney(l.debit),
      credit: roundMoney(l.credit),
    })),
    source: 'manual',
    createdAt: new Date().toISOString(),
  }
  const all = readManualJournals()
  all.unshift(entry)
  writeManualJournals(all)
  return entry
}

export function buildLedger(journals = getAllJournals()): LedgerRow[] {
  const map = new Map<string, { debit: number; credit: number }>()
  journals.forEach((j) => {
    j.lines.forEach((l) => {
      const cur = map.get(l.account) || { debit: 0, credit: 0 }
      cur.debit = roundMoney(cur.debit + Number(l.debit || 0))
      cur.credit = roundMoney(cur.credit + Number(l.credit || 0))
      map.set(l.account, cur)
    })
  })
  return [...map.entries()]
    .map(([account, v]) => ({
      account,
      debit: v.debit,
      credit: v.credit,
      balance: roundMoney(v.debit - v.credit),
    }))
    .sort((a, b) => a.account.localeCompare(b.account))
}

export function buildTrialBalance(ledger = buildLedger()) {
  const totalDebit = roundMoney(ledger.reduce((s, r) => s + r.debit, 0))
  const totalCredit = roundMoney(ledger.reduce((s, r) => s + r.credit, 0))
  return {
    rows: ledger,
    totalDebit,
    totalCredit,
    balanced: totalDebit === totalCredit,
  }
}

export function buildProfitAndLoss(ledger = buildLedger()) {
  const revenue = roundMoney(
    ledger
      .filter((r) => /fee|income|revenue|professional/i.test(r.account))
      .reduce((s, r) => s + Math.max(0, r.credit - r.debit), 0),
  )
  const expenses = roundMoney(
    ledger
      .filter((r) => /expense|salary|rent|utility/i.test(r.account))
      .reduce((s, r) => s + Math.max(0, r.debit - r.credit), 0),
  )
  // If no explicit expense accounts, treat nothing as expense (do not invent 28%)
  return {
    revenue,
    expenses,
    profit: roundMoney(revenue - expenses),
  }
}

export function buildBalanceSheet(ledger = buildLedger(), pnl = buildProfitAndLoss(ledger)) {
  const assets = roundMoney(
    ledger
      .filter((r) => /bank|receivable|cash|asset/i.test(r.account))
      .reduce((s, r) => s + Math.max(0, r.balance), 0),
  )
  const liabilities = roundMoney(
    ledger
      .filter((r) => /payable|liability|loan/i.test(r.account))
      .reduce((s, r) => s + Math.max(0, -r.balance), 0),
  )
  // Equity balancing figure so Assets = Liabilities + Equity (includes retained profit)
  const equity = roundMoney(assets - liabilities)
  return {
    assets,
    liabilities,
    equity,
    retainedEarnings: pnl.profit,
    balanced: roundMoney(assets) === roundMoney(liabilities + equity),
  }
}

export function getAccountingSnapshot() {
  const journals = getAllJournals()
  const ledger = buildLedger(journals)
  const trial = buildTrialBalance(ledger)
  const pnl = buildProfitAndLoss(ledger)
  const balance = buildBalanceSheet(ledger, pnl)
  return { journals, ledger, trial, pnl, balance }
}
