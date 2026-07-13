import { useQuery } from '@tanstack/react-query'
import {
  IndianRupee, Users, Building2, FileText, ShieldCheck, Calendar, UserCog,
  ArrowRight, Clock, Cake, CheckCircle2, CreditCard,
} from 'lucide-react'
import { motion } from 'framer-motion'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import { DashboardService, ReportService } from '@/services'
import { StatCard, Card, CardHeader, CardTitle, Badge, Avatar, DashboardSkeleton } from '@/components/common'
import { formatCurrency, formatDate, formatRelativeTime, chartTheme } from '@/utils'
import { Link } from 'react-router'

const CHART_COLORS = ['#6366f1', '#10b981', '#f97316', '#8b5cf6', '#ef4444']

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => DashboardService.getData(),
  })

  const { data: reports } = useQuery({
    queryKey: ['reports'],
    queryFn: () => ReportService.getData(),
  })

  if (isLoading || !data) return <DashboardSkeleton />

  const kpis = [
    { key: 'revenue', title: 'Revenue', icon: IndianRupee, format: 'currency' as const, color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400', to: '/reports' },
    { key: 'outstanding', title: 'Outstanding', icon: CreditCard, format: 'currency' as const, color: 'bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400', to: '/payments' },
    { key: 'invoices', title: 'Invoices', icon: FileText, format: 'number' as const, color: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400', to: '/invoices' },
    { key: 'clients', title: 'Active Clients', icon: Users, format: 'number' as const, color: 'bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400', to: '/clients' },
    { key: 'companies', title: 'Companies', icon: Building2, format: 'number' as const, color: 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400', to: '/companies' },
    { key: 'pendingCompliance', title: 'Pending Compliance', icon: ShieldCheck, format: 'number' as const, color: 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400', to: '/compliance/gst' },
    { key: 'upcomingDueDates', title: 'Due This Week', icon: Calendar, format: 'number' as const, color: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400', to: '/calendar' },
    { key: 'employees', title: 'Employees', icon: UserCog, format: 'number' as const, color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300', to: '/employees' },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Welcome back! Here's what's happening at your practice.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <Link key={kpi.key} to={kpi.to} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded-2xl">
            <StatCard
              title={kpi.title}
              kpi={data.kpis[kpi.key]}
              icon={kpi.icon}
              format={kpi.format}
              color={kpi.color}
              delay={i * 0.05}
            />
          </Link>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Revenue Overview</CardTitle>
          </CardHeader>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={reports?.revenue}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: chartTheme.tick }} stroke={chartTheme.tick} />
              <YAxis tick={{ fontSize: 12, fill: chartTheme.tick }} stroke={chartTheme.tick} tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`} />
              <Tooltip formatter={(v) => formatCurrency(Number(v))} {...chartTheme.tooltip} />
              <Area type="monotone" dataKey="revenue" stroke="#6366f1" fill="url(#revenueGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>GST Filing Status</CardTitle>
          </CardHeader>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={reports?.gstFiled}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: chartTheme.tick }} stroke={chartTheme.tick} />
              <YAxis tick={{ fontSize: 12, fill: chartTheme.tick }} stroke={chartTheme.tick} />
              <Tooltip {...chartTheme.tooltip} />
              <Bar dataKey="filed" fill="#10b981" radius={[4, 4, 0, 0]} name="Filed" />
              <Bar dataKey="pending" fill="#f97316" radius={[4, 4, 0, 0]} name="Pending" />
              <Bar dataKey="overdue" fill="#ef4444" radius={[4, 4, 0, 0]} name="Overdue" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Second Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Client Growth</CardTitle>
          </CardHeader>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={reports?.clientGrowth}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: chartTheme.tick }} stroke={chartTheme.tick} />
              <YAxis tick={{ fontSize: 11, fill: chartTheme.tick }} stroke={chartTheme.tick} />
              <Tooltip {...chartTheme.tooltip} />
              <Area type="monotone" dataKey="clients" stroke="#6366f1" fill="#6366f1" fillOpacity={0.1} strokeWidth={2} />
              <Area type="monotone" dataKey="companies" stroke="#10b981" fill="#10b981" fillOpacity={0.1} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Task Completion</CardTitle>
          </CardHeader>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={reports?.taskCompletion}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: chartTheme.tick }} stroke={chartTheme.tick} />
              <YAxis tick={{ fontSize: 11, fill: chartTheme.tick }} stroke={chartTheme.tick} />
              <Tooltip {...chartTheme.tooltip} />
              <Bar dataKey="completed" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="pending" fill="#94a3b8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Service Breakdown</CardTitle>
          </CardHeader>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={reports?.serviceBreakdown?.slice(0, 5)}
                dataKey="count"
                nameKey="service"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={3}
              >
                {reports?.serviceBreakdown?.slice(0, 5).map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip {...chartTheme.tooltip} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Widgets Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <Link to="/clients" className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <div className="space-y-4">
            {data.recentActivity.map((activity, i) => (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-start gap-3"
              >
                <div className="h-8 w-8 rounded-full bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">{activity.message}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{formatRelativeTime(activity.timestamp)}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </Card>

        {/* Today's Tasks */}
        <Card>
          <CardHeader>
            <CardTitle>Today's Tasks</CardTitle>
            <Link to="/tasks" className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <div className="space-y-3">
            {data.todaysTasks.map((task) => (
              <div key={task.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                <div className="h-2 w-2 rounded-full bg-primary-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{task.title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                    <Clock className="h-3 w-3" /> Due {formatDate(task.dueDate)}
                  </p>
                </div>
                <Badge priority={task.priority} variant="priority" />
              </div>
            ))}
          </div>
        </Card>

        {/* Upcoming Due Dates */}
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Due Dates</CardTitle>
            <Link to="/compliance" className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <div className="space-y-3">
            {data.upcomingDueDates.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.clientName}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{item.service}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-orange-600">{formatDate(item.dueDate, 'DD MMM')}</p>
                  <Badge status={item.status} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Payments</CardTitle>
          </CardHeader>
          <div className="space-y-3">
            {data.recentPayments.map((payment) => (
              <div key={payment.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{payment.clientName}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{payment.invoiceNumber}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(payment.amount)}</p>
                  <p className="text-xs text-gray-400">{formatDate(payment.paymentDate)}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cake className="h-4 w-4 text-orange-500" /> Birthdays This Month
            </CardTitle>
          </CardHeader>
          <div className="space-y-3">
            {data.birthdays.length > 0 ? data.birthdays.map((emp) => (
              <div key={emp.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <Avatar src={emp.avatar} name={`${emp.firstName} ${emp.lastName}`} />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{emp.firstName} {emp.lastName}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{emp.designation}</p>
                </div>
                <span className="ml-auto text-xs text-orange-600 font-medium">
                  {formatDate(emp.dateOfBirth, 'DD MMM')}
                </span>
              </div>
            )) : (
              <p className="text-sm text-gray-400 text-center py-4">No birthdays this month</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
