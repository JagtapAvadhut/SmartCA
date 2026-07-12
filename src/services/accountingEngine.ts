import { http } from './httpClient'
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

export function assertBalanced(
  lines: JournalLine[],
): { ok: true; debit: number; credit: number } | { ok: false; message: string; debit: number; credit: number } {
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

export async function getAllJournals(): Promise<JournalEntry[]> {
  return http.get<JournalEntry[]>('/accounting/journals')
}

/** @deprecated Prefer getAllJournals(); kept for UI that listed manual-only rows. */
export async function readManualJournals(): Promise<JournalEntry[]> {
  const all = await getAllJournals()
  return all.filter((j) => j.source === 'manual' || (!j.source && !String(j.id).startsWith('SYS-')))
}

export async function postManualJournal(input: {
  date: string
  narration: string
  lines: JournalLine[]
}): Promise<JournalEntry> {
  const check = assertBalanced(input.lines)
  if (!check.ok) throw new Error(check.message)
  return http.post<JournalEntry>('/accounting/journals', {
    date: input.date,
    narration: input.narration,
    lines: input.lines.map((l) => ({
      account: l.account.trim(),
      debit: roundMoney(l.debit),
      credit: roundMoney(l.credit),
    })),
  })
}

export type AccountingSnapshot = {
  journals: JournalEntry[]
  ledger: LedgerRow[]
  trial: {
    rows: LedgerRow[]
    totalDebit: number
    totalCredit: number
    balanced: boolean
  }
  pnl: { revenue: number; expenses: number; profit: number }
  balance: {
    assets: number
    liabilities: number
    equity: number
    retainedEarnings: number
    balanced: boolean
  }
}

export async function getAccountingSnapshot(): Promise<AccountingSnapshot> {
  return http.get<AccountingSnapshot>('/accounting/statements')
}

export function buildLedger(journals: JournalEntry[]): LedgerRow[] {
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

export function buildTrialBalance(ledger: LedgerRow[]) {
  const totalDebit = roundMoney(ledger.reduce((s, r) => s + r.debit, 0))
  const totalCredit = roundMoney(ledger.reduce((s, r) => s + r.credit, 0))
  return {
    rows: ledger,
    totalDebit,
    totalCredit,
    balanced: totalDebit === totalCredit,
  }
}

export function buildProfitAndLoss(ledger: LedgerRow[]) {
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
  return {
    revenue,
    expenses,
    profit: roundMoney(revenue - expenses),
  }
}

export function buildBalanceSheet(ledger: LedgerRow[], pnl = buildProfitAndLoss(ledger)) {
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
  const equity = roundMoney(assets - liabilities)
  return {
    assets,
    liabilities,
    equity,
    retainedEarnings: pnl.profit,
    balanced: roundMoney(assets) === roundMoney(liabilities + equity),
  }
}
