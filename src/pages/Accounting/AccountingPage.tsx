import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'
import { BookOpen, Scale, TrendingUp, Calculator, Plus, FileSpreadsheet } from 'lucide-react'
import toast from 'react-hot-toast'
import { PageHeader, Card, CardTitle, Button, Badge, Input } from '@/components/common'
import { formatCurrency, cn } from '@/utils'
import {
  getAccountingSnapshot,
  postManualJournal,
  assertBalanced,
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
  const [formOpen, setFormOpen] = useState(false)
  const [narration, setNarration] = useState('')
  const [debitAccount, setDebitAccount] = useState('Accounts Receivable')
  const [creditAccount, setCreditAccount] = useState('Professional Fees')
  const [amount, setAmount] = useState(10000)
  const queryClient = useQueryClient()

  const setTab = (id: Tab) => {
    const next = new URLSearchParams(params)
    next.set('tab', id)
    setParams(next)
  }

  const { data: snap, isLoading } = useQuery({
    queryKey: ['accounting-snapshot'],
    queryFn: () => getAccountingSnapshot(),
  })

  const ledger = snap?.ledger || []
  const trial = snap?.trial
  const pnl = snap?.pnl
  const balance = snap?.balance
  const journals = snap?.journals || []

  const addJournal = async () => {
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
      await postManualJournal({
        date: dayjs().format('YYYY-MM-DD'),
        narration: narration.trim(),
        lines,
      })
      toast.success('Journal posted')
      setFormOpen(false)
      setNarration('')
      void queryClient.invalidateQueries({ queryKey: ['accounting-snapshot'] })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to post journal')
    }
  }

  const empty = useMemo(() => !snap && !isLoading, [snap, isLoading])

  return (
    <div>
      <PageHeader
        title="Accounting"
        description="Live journals and statements from the Go API"
        actions={
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" /> Post Journal
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2 mb-6">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              'inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              tab === id
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200',
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-sm text-gray-500">Loading accounting data…</p>}
      {empty && <p className="text-sm text-gray-500">No accounting data</p>}

      {tab === 'ledger' && (
        <Card>
          <CardTitle className="mb-4">General Ledger</CardTitle>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b dark:border-gray-700">
                  <th className="py-2">Account</th>
                  <th className="py-2">Debit</th>
                  <th className="py-2">Credit</th>
                  <th className="py-2">Balance</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((r) => (
                  <tr key={r.account} className="border-b dark:border-gray-800">
                    <td className="py-2">{r.account}</td>
                    <td className="py-2">{formatCurrency(r.debit)}</td>
                    <td className="py-2">{formatCurrency(r.credit)}</td>
                    <td className="py-2">{formatCurrency(r.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === 'journals' && (
        <Card>
          <CardTitle className="mb-4">Journal Entries</CardTitle>
          <div className="space-y-3">
            {journals.map((j) => (
              <div key={j.id} className="p-3 rounded-xl border border-gray-100 dark:border-gray-800">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="font-medium">{j.narration}</p>
                  <Badge>{j.source || 'manual'}</Badge>
                </div>
                <p className="text-xs text-gray-500 mb-2">{j.date}</p>
                <ul className="text-sm space-y-1">
                  {j.lines.map((l, i) => (
                    <li key={`${j.id}-${i}`}>
                      {l.account}: Dr {formatCurrency(l.debit)} / Cr {formatCurrency(l.credit)}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === 'trial' && trial && (
        <Card>
          <CardTitle className="mb-2">Trial Balance</CardTitle>
          <p className="text-sm text-gray-500 mb-4">
            Debit {formatCurrency(trial.totalDebit)} · Credit {formatCurrency(trial.totalCredit)} ·{' '}
            {trial.balanced ? 'Balanced' : 'Out of balance'}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b dark:border-gray-700">
                  <th className="py-2">Account</th>
                  <th className="py-2">Debit</th>
                  <th className="py-2">Credit</th>
                </tr>
              </thead>
              <tbody>
                {trial.rows.map((r) => (
                  <tr key={r.account} className="border-b dark:border-gray-800">
                    <td className="py-2">{r.account}</td>
                    <td className="py-2">{formatCurrency(r.debit)}</td>
                    <td className="py-2">{formatCurrency(r.credit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === 'pnl' && pnl && (
        <Card>
          <CardTitle className="mb-4">Profit & Loss</CardTitle>
          <div className="space-y-2 text-sm">
            <p>Revenue: {formatCurrency(pnl.revenue)}</p>
            <p>Expenses: {formatCurrency(pnl.expenses)}</p>
            <p className="font-semibold">Profit: {formatCurrency(pnl.profit)}</p>
          </div>
        </Card>
      )}

      {tab === 'balance' && balance && (
        <Card>
          <CardTitle className="mb-4">Balance Sheet</CardTitle>
          <div className="space-y-2 text-sm">
            <p>Assets: {formatCurrency(balance.assets)}</p>
            <p>Liabilities: {formatCurrency(balance.liabilities)}</p>
            <p>Equity: {formatCurrency(balance.equity)}</p>
            <p>Retained earnings: {formatCurrency(balance.retainedEarnings)}</p>
            <p>{balance.balanced ? 'Balanced' : 'Out of balance'}</p>
          </div>
        </Card>
      )}

      {formOpen && (
        <Card className="mt-6">
          <CardTitle className="mb-4">Post Manual Journal</CardTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Narration" value={narration} onChange={(e) => setNarration(e.target.value)} />
            <Input
              label="Amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
            <Input
              label="Debit account"
              value={debitAccount}
              onChange={(e) => setDebitAccount(e.target.value)}
            />
            <Input
              label="Credit account"
              value={creditAccount}
              onChange={(e) => setCreditAccount(e.target.value)}
            />
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={() => void addJournal()}>Post</Button>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
