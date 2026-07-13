import { useQuery } from '@tanstack/react-query'
import { Download, TrendingUp } from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line,
} from 'recharts'
import toast from 'react-hot-toast'
import { ReportService } from '@/services'
import { PageHeader, Card, CardHeader, CardTitle, Button, StatCard, DashboardSkeleton } from '@/components/common'
import { formatCurrency, exportToCSV, chartTheme } from '@/utils'

export default function ReportsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['reports'],
    queryFn: () => ReportService.getData(),
  })

  if (isLoading || !data) return <DashboardSkeleton />

  const totalRevenue = data.revenue.reduce((s, r) => s + r.revenue, 0)
  const totalProfit = data.revenue.reduce((s, r) => s + r.profit, 0)

  return (
    <div className="space-y-8">
      <PageHeader
        title="Reports & Analytics"
        description="Comprehensive business intelligence for your CA practice"
        actions={
          <Button variant="outline" onClick={() => {
            exportToCSV(data.revenue.map((r) => ({ ...r })), 'revenue-report')
            exportToCSV(data.serviceBreakdown.map((s) => ({ ...s })), 'service-breakdown')
            toast.success('Reports exported as CSV')
          }}>
            <Download className="h-4 w-4" /> Export Report
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total Revenue" kpi={{ value: totalRevenue, change: 12.5, trend: 'up' }} icon={TrendingUp} format="currency" color="bg-emerald-50 text-emerald-600" />
        <StatCard title="Net Profit" kpi={{ value: totalProfit, change: 8.3, trend: 'up' }} icon={TrendingUp} format="currency" color="bg-primary-50 text-primary-600" />
        <StatCard title="Active Services" kpi={{ value: data.serviceBreakdown.length, change: 2, trend: 'up' }} icon={TrendingUp} format="number" color="bg-blue-50 text-blue-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Revenue vs Expenses</CardTitle></CardHeader>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data.revenue}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: chartTheme.tick }} />
              <YAxis tick={{ fontSize: 12, fill: chartTheme.tick }} tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`} />
              <Tooltip formatter={(v) => formatCurrency(Number(v))} {...chartTheme.tooltip} />
              <Area type="monotone" dataKey="revenue" stroke="#6366f1" fill="#6366f1" fillOpacity={0.1} strokeWidth={2} name="Revenue" />
              <Area type="monotone" dataKey="expenses" stroke="#f97316" fill="#f97316" fillOpacity={0.1} strokeWidth={2} name="Expenses" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <CardHeader><CardTitle>Outstanding Trend</CardTitle></CardHeader>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data.outstandingTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: chartTheme.tick }} />
              <YAxis tick={{ fontSize: 12, fill: chartTheme.tick }} tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`} />
              <Tooltip formatter={(v) => formatCurrency(Number(v))} {...chartTheme.tooltip} />
              <Line type="monotone" dataKey="amount" stroke="#f97316" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <CardHeader><CardTitle>ITR Filing Status</CardTitle></CardHeader>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.itrFiled}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: chartTheme.tick }} />
              <YAxis tick={{ fontSize: 12, fill: chartTheme.tick }} />
              <Tooltip {...chartTheme.tooltip} />
              <Bar dataKey="filed" fill="#10b981" radius={[4, 4, 0, 0]} name="Filed" />
              <Bar dataKey="pending" fill="#f97316" radius={[4, 4, 0, 0]} name="Pending" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <CardHeader><CardTitle>Employee Performance</CardTitle></CardHeader>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.employeePerformance} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
              <XAxis type="number" tick={{ fontSize: 12, fill: chartTheme.tick }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: chartTheme.tick }} width={100} />
              <Tooltip {...chartTheme.tooltip} />
              <Bar dataKey="tasksCompleted" fill="#6366f1" radius={[0, 4, 4, 0]} name="Tasks" />
              <Bar dataKey="clientsManaged" fill="#10b981" radius={[0, 4, 4, 0]} name="Clients" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Service Revenue Breakdown</CardTitle></CardHeader>
        <div className="table-scroll">
          <table className="w-full min-w-[480px]">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Service</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Clients</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {data.serviceBreakdown.map((s) => (
                <tr key={s.service} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className="py-3 px-4 text-sm font-medium text-gray-900 dark:text-gray-100">{s.service}</td>
                  <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400 text-right">{s.count}</td>
                  <td className="py-3 px-4 text-sm font-semibold text-gray-900 dark:text-gray-100 text-right">{formatCurrency(s.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
