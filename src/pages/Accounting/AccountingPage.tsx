import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { BookOpen, Scale, TrendingUp, Calculator, Plus, FileSpreadsheet } from 'lucide-react'
import toast from 'react-hot-toast'
import { PageHeader, Card, CardTitle, Button, Badge, Input } from '@/components/common'
import { formatCurrency, cn } from '@/utils'
import {
  getAccountingSnapshot,
  postManualJournal,
  assertBalanced,
  readManualJournals,
} from '@/services/accountingEngine'
import dayjs from 'dayjs'

type Tab = 'ledger' | 'journals' | 'trial' | 'pnl' | 'balance'

const TABS: Array<{ id: Tab; label: string; icon: typeof BookOpen }> = [
  { id: 'ledger', label: 'General Ledger', icon: BookOpen },
  { id: 'journals', label: 'Journal Entries', icon: FileSpreadsheet },
  { id: 'trial', label: 'Trial Balance', icon: Scale },
  { id: 'pnl', label: 'Profit & Loss', icon: TrendingUp },
  { id: 'balance', label: 'Balance Sheet', icon: Calculator },
]

export default function AccountingPage() {
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) || 'ledger'
  const [tick, setTick] = useState(0)
  const [formOpen, setFormOpen] = useState(false)
  const [narration, setNarration] = useState('')
  const [debitAccount, setDebitAccount] = useState('Accounts Receivable')
  const [creditAccount, setCreditAccount] = useState('Professional Fees')
  const [amount, setAmount] = useState(10000)

  const setTab = (id: Tab) => {
    const next = new URLSearchParams(params)
    next.set('tab', id)
    setParams(next)
  }

  const snap = useMemo(() => getAccountingSnapshot(), [tick])
  const { ledger, trial, pnl, balance } = snap
  const journals = snap.journals

  const addJournal = () => {
    if (!narration.trim() || amount <= 0) {
      toast.error('Enter narration and a valid amount')
      return
    }
    if (debitAccount === creditAccount) {
      toast.error('Debit and credit accounts must differ')
      return
    }
    const lines = [
      { account: debitAccount, debit: amount, credit: 0 },
      { account: creditAccount, debit: 0, credit: amount },
    ]
    const check = assertBalanced(lines)
    if (!check.ok) {
      toast.error(check.message)
      return
    }
    try {
      postManualJournal({
        date: dayjs().format('YYYY-MM-DD'),
        narration: narration.trim(),
        lines,
      })
      toast.success('Journal posted')
      setFormOpen(false)
      setNarration('')
      setTick((t) => t + 1)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to post journal')
    }
  }

  return (
    <div>
      <PageHeader
        title="Accounting"
        description="Live books from invoices/payments + balanced manual journals"
        actions={
          <Button onClick={() => { setTick((t) => t + 1); toast.success('Books refreshed from source data') }}>
            Refresh Books
          </Button>
        }
      />

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin mb-4">
        {TABS.map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap',
                tab === t.id
                  ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800',
              )}
            >
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'ledger' && (
        <Card padding={false}>
          <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex justify-between">
            <CardTitle>General Ledger</CardTitle>
            <Badge>{trial.balanced ? 'In balance' : 'Out of balance'}</Badge>
          </div>
          <div className="table-scroll">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 text-xs uppercase text-gray-500">
                  <th className="px-4 py-3 text-left">Account</th>
                  <th className="px-4 py-3 text-right">Debit</th>
                  <th className="px-4 py-3 text-right">Credit</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((r) => (
                  <tr key={r.account} className="border-b border-gray-50 dark:border-gray-800">
                    <td className="px-4 py-3 text-sm">{r.account}</td>
                    <td className="px-4 py-3 text-sm text-right">{formatCurrency(r.debit)}</td>
                    <td className="px-4 py-3 text-sm text-right">{formatCurrency(r.credit)}</td>
                    <td className="px-4 py-3 text-sm text-right font-medium">{formatCurrency(r.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === 'journals' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setFormOpen(true)}><Plus className="h-4 w-4" /> Post Journal</Button>
          </div>
          {formOpen && (
            <Card>
              <CardTitle className="mb-4">New Journal Entry</CardTitle>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Narration" value={narration} onChange={(e) => setNarration(e.target.value)} />
                <Input label="Amount" type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
                <Input label="Debit Account" value={debitAccount} onChange={(e) => setDebitAccount(e.target.value)} />
                <Input label="Credit Account" value={creditAccount} onChange={(e) => setCreditAccount(e.target.value)} />
              </div>
              <p className="text-xs text-gray-500 mt-2">Debits must equal credits. Unbalanced entries are rejected.</p>
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
                <Button onClick={addJournal}>Post</Button>
              </div>
            </Card>
          )}
          <Card padding={false}>
            <div className="divide-y divide-gray-50 dark:divide-gray-800 max-h-[560px] overflow-y-auto">
              {journals.map((j) => (
                <div key={j.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{j.narration}</p>
                    <div className="flex gap-2">
                      {j.source && <Badge>{j.source}</Badge>}
                      <span className="text-xs text-gray-400">{j.date}</span>
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-gray-500 space-y-0.5">
                    {j.lines.map((l, i) => (
                      <p key={i}>{l.account}: Dr {formatCurrency(l.debit)} / Cr {formatCurrency(l.credit)}</p>
                    ))}
                  </div>
                </div>
              ))}
              {journals.length === 0 && <p className="p-8 text-center text-sm text-gray-400">No journals yet</p>}
            </div>
            <p className="px-4 py-2 text-xs text-gray-400 border-t border-gray-100 dark:border-gray-800">
              Manual journals stored: {readManualJournals().length}. System journals are derived live from invoices/payments (no double-seed).
            </p>
          </Card>
        </div>
      )}

      {tab === 'trial' && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <CardTitle>Trial Balance</CardTitle>
            <Badge status={trial.balanced ? 'paid' : 'overdue'}>{trial.balanced ? 'Balanced' : 'Unbalanced'}</Badge>
          </div>
          <div className="table-scroll">
            <table className="w-full min-w-[480px]">
              <thead>
                <tr className="text-xs uppercase text-gray-500 border-b border-gray-100 dark:border-gray-800">
                  <th className="py-2 text-left">Account</th>
                  <th className="py-2 text-right">Debit</th>
                  <th className="py-2 text-right">Credit</th>
                </tr>
              </thead>
              <tbody>
                {trial.rows.map((r) => (
                  <tr key={r.account} className="border-b border-gray-50 dark:border-gray-800 text-sm">
                    <td className="py-2">{r.account}</td>
                    <td className="py-2 text-right">{formatCurrency(r.debit)}</td>
                    <td className="py-2 text-right">{formatCurrency(r.credit)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold text-sm">
                  <td className="pt-3">Total</td>
                  <td className="pt-3 text-right">{formatCurrency(trial.totalDebit)}</td>
                  <td className="pt-3 text-right">{formatCurrency(trial.totalCredit)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}

      {tab === 'pnl' && (
        <Card>
          <CardTitle className="mb-4">Profit &amp; Loss</CardTitle>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span>Revenue (fees/income)</span><span className="font-medium">{formatCurrency(pnl.revenue)}</span></div>
            <div className="flex justify-between"><span>Expenses</span><span className="font-medium">{formatCurrency(pnl.expenses)}</span></div>
            <div className="flex justify-between border-t border-gray-100 dark:border-gray-800 pt-3 text-base font-semibold">
              <span>Net Profit</span><span>{formatCurrency(pnl.profit)}</span>
            </div>
          </div>
        </Card>
      )}

      {tab === 'balance' && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <CardTitle>Balance Sheet</CardTitle>
            <Badge status={balance.balanced ? 'paid' : 'overdue'}>{balance.balanced ? 'A = L + E' : 'Check'}</Badge>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span>Assets</span><span className="font-medium">{formatCurrency(balance.assets)}</span></div>
            <div className="flex justify-between"><span>Liabilities</span><span className="font-medium">{formatCurrency(balance.liabilities)}</span></div>
            <div className="flex justify-between"><span>Equity (incl. P&amp;L)</span><span className="font-medium">{formatCurrency(balance.equity)}</span></div>
            <div className="flex justify-between border-t border-gray-100 dark:border-gray-800 pt-3 text-xs text-gray-500">
              <span>Retained earnings (P&amp;L profit)</span><span>{formatCurrency(balance.retainedEarnings)}</span>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
