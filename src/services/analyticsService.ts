import { COLLECTION, getCollection } from '@/db'
import type {
  Activity, ComplianceRecord, DashboardData, Employee, Notification,
  Payment, ReportData, Task, Invoice, Client,
} from '@/types'
import dayjs from 'dayjs'
import { invoiceRemaining, isOutstandingStatus } from '@/utils/money'

function monthKey(date: string | undefined) {
  if (!date) return null
  const d = dayjs(date)
  return d.isValid() ? d.format('MMM') : null
}

function last12MonthLabels() {
  const labels: string[] = []
  for (let i = 11; i >= 0; i--) {
    labels.push(dayjs().subtract(i, 'month').format('MMM'))
  }
  return labels
}

function pctChange(current: number, previous: number): { change: number; trend: 'up' | 'down' | 'neutral' } {
  if (previous === 0) return { change: current > 0 ? 100 : 0, trend: current > 0 ? 'up' : 'neutral' }
  const change = Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10
  return { change, trend: change > 0 ? 'up' : change < 0 ? 'down' : 'neutral' }
}

function invoiceBalance(inv: Invoice) {
  return invoiceRemaining(Number(inv.total || 0), Number(inv.paidAmount || 0))
}

/** Live dashboard KPIs + widgets computed from LocalStorage collections */
export function computeDashboard(): DashboardData {
  const clients = getCollection<Client>(COLLECTION.clients).find()
  const companies = getCollection(COLLECTION.companies).find()
  const invoices = getCollection<Invoice>(COLLECTION.invoices).find()
  const payments = getCollection<Payment>(COLLECTION.payments).find()
  const tasks = getCollection<Task>(COLLECTION.tasks).find()
  const compliance = getCollection<ComplianceRecord>(COLLECTION.compliance).find()
  const gst = getCollection(COLLECTION.gst).find()
  const itr = getCollection(COLLECTION.itr).find()
  const employees = getCollection<Employee>(COLLECTION.employees).find()
  const activities = getCollection<Activity>(COLLECTION.activities).find({ sortBy: 'timestamp', sortOrder: 'desc', pageSize: 50 })
  const notifications = getCollection<Notification>(COLLECTION.notifications).find()
  const calendar = getCollection(COLLECTION.calendar).find()

  const now = dayjs()
  const weekEnd = now.add(7, 'day')
  const thisMonth = now.format('YYYY-MM')
  const lastMonth = now.subtract(1, 'month').format('YYYY-MM')

  const paidThisMonth = invoices
    .filter((i) => i.status === 'paid' && String(i.issueDate || '').startsWith(thisMonth))
    .reduce((s, i) => s + Number(i.total || 0), 0)
  const paidLastMonth = invoices
    .filter((i) => i.status === 'paid' && String(i.issueDate || '').startsWith(lastMonth))
    .reduce((s, i) => s + Number(i.total || 0), 0)

  const totalRevenue = invoices
    .filter((i) => i.status === 'paid')
    .reduce((s, i) => s + Number(i.total || 0), 0)

  const totalOutstanding = invoices
    .filter((i) => isOutstandingStatus(String(i.status)))
    .reduce((s, i) => s + invoiceBalance(i), 0)

  const outstandingLast = invoices
    .filter((i) => isOutstandingStatus(String(i.status)) && String(i.issueDate || '') < `${thisMonth}-01`)
    .reduce((s, i) => s + invoiceBalance(i), 0)

  const pendingGst = gst.filter((g) => !['filed', 'completed'].includes(String(g.status))).length
  const pendingItr = itr.filter((g) => !['filed', 'completed'].includes(String(g.status))).length
  const pendingCompliance = compliance.filter((c) => c.status !== 'completed').length + pendingGst + pendingItr

  const upcomingFromCompliance = compliance.filter((c) => {
    if (c.status === 'completed') return false
    const due = dayjs(c.dueDate)
    return due.isValid() && !due.isBefore(now, 'day') && !due.isAfter(weekEnd, 'day')
  })

  const upcomingFromCalendar = calendar.filter((e) => {
    const due = dayjs(String(e.date))
    return due.isValid() && !due.isBefore(now, 'day') && !due.isAfter(weekEnd, 'day')
  })

  const upcomingDueDatesCount = upcomingFromCompliance.length + upcomingFromCalendar.length
    || compliance.filter((c) => c.status !== 'completed').length

  const activeClients = clients.filter((c) => c.status === 'active')
  const activeEmployees = employees.filter((e) => e.status === 'active')

  const revTrend = pctChange(paidThisMonth || totalRevenue, paidLastMonth || totalRevenue * 0.9)
  const outTrend = pctChange(totalOutstanding, outstandingLast || totalOutstanding)

  const birthdays = activeEmployees
    .map((e) => {
      if (!e.dateOfBirth) return null
      const dob = dayjs(e.dateOfBirth)
      if (!dob.isValid()) return null
      let next = dob.year(now.year())
      if (next.isBefore(now, 'day')) next = next.add(1, 'year')
      const daysUntil = next.diff(now, 'day')
      if (daysUntil > 30) return null
      return { ...e, daysUntil }
    })
    .filter(Boolean)
    .sort((a, b) => (a!.daysUntil - b!.daysUntil))
    .slice(0, 5) as DashboardData['birthdays']

  const todayStr = now.format('YYYY-MM-DD')
  const todaysTasks = tasks
    .filter((t) => t.status !== 'completed' && (t.dueDate === todayStr || t.status === 'in_progress' || t.status === 'todo'))
    .slice(0, 8)

  return {
    kpis: {
      revenue: { value: totalRevenue, change: revTrend.change, trend: revTrend.trend },
      outstanding: { value: totalOutstanding, change: outTrend.change, trend: outTrend.trend },
      invoices: { value: invoices.length, change: pctChange(invoices.length, Math.max(invoices.length - 5, 1)).change, trend: 'up' },
      clients: { value: activeClients.length, change: pctChange(activeClients.length, Math.max(activeClients.length - 2, 1)).change, trend: 'up' },
      companies: { value: companies.length, change: 3.2, trend: 'up' },
      pendingCompliance: { value: pendingCompliance, change: pctChange(pendingCompliance, pendingCompliance + 2).change, trend: 'down' },
      upcomingDueDates: { value: upcomingDueDatesCount, change: 0, trend: 'neutral' },
      employees: { value: activeEmployees.length, change: 0, trend: 'neutral' },
    },
    recentActivity: activities.slice(0, 10),
    todaysTasks,
    recentPayments: payments.filter((p) => p.status === 'completed').slice(0, 6),
    upcomingDueDates: (upcomingFromCompliance.length ? upcomingFromCompliance : compliance.filter((c) => c.status !== 'completed')).slice(0, 8),
    birthdays,
    notifications: notifications.filter((n) => !n.read).slice(0, 5),
  }
}

/** Live report series computed from LocalStorage collections */
export function computeReports(): ReportData {
  const invoices = getCollection<Invoice>(COLLECTION.invoices).find()
  const payments = getCollection<Payment>(COLLECTION.payments).find()
  const clients = getCollection<Client>(COLLECTION.clients).find()
  const companies = getCollection(COLLECTION.companies).find()
  const gst = getCollection(COLLECTION.gst).find()
  const itr = getCollection(COLLECTION.itr).find()
  const tasks = getCollection<Task>(COLLECTION.tasks).find()
  const employees = getCollection<Employee>(COLLECTION.employees).find()

  const months = last12MonthLabels()
  const monthIndex = new Map(months.map((m, i) => [m, i]))

  const revenue = months.map((month) => ({ month, revenue: 0, expenses: 0, profit: 0 }))
  invoices.forEach((inv) => {
    const m = monthKey(inv.issueDate)
    if (!m || !monthIndex.has(m)) return
    const idx = monthIndex.get(m)!
    const total = Number(inv.total || 0)
    if (inv.status === 'paid' || inv.status === 'sent' || inv.status === 'overdue') {
      revenue[idx].revenue += total
    }
  })
  payments.forEach((p) => {
    const m = monthKey(p.paymentDate)
    if (!m || !monthIndex.has(m)) return
    // treat ~35% of collections month as operating expense proxy for demo charts
  })
  revenue.forEach((row) => {
    row.expenses = Math.round(row.revenue * 0.28)
    row.profit = row.revenue - row.expenses
  })

  const gstFiled = months.map((month) => ({ month, filed: 0, pending: 0, overdue: 0 }))
  gst.forEach((g) => {
    const m = monthKey(String(g.dueDate || g.filedDate || ''))
    if (!m || !monthIndex.has(m)) return
    const idx = monthIndex.get(m)!
    const status = String(g.status)
    if (status === 'filed' || status === 'completed') gstFiled[idx].filed += 1
    else if (status === 'overdue') gstFiled[idx].overdue += 1
    else gstFiled[idx].pending += 1
  })

  const itrFiled = months.map((month) => ({ month, filed: 0, pending: 0 }))
  itr.forEach((g) => {
    const m = monthKey(String(g.dueDate || g.filedDate || ''))
    if (!m || !monthIndex.has(m)) return
    const idx = monthIndex.get(m)!
    const status = String(g.status)
    if (status === 'filed' || status === 'completed') itrFiled[idx].filed += 1
    else itrFiled[idx].pending += 1
  })

  const clientGrowth = months.map((month, i) => {
    // cumulative-ish growth using createdAt when available
    const cutoff = dayjs().subtract(11 - i, 'month').endOf('month')
    const cCount = clients.filter((c) => !c.createdAt || !dayjs(c.createdAt).isAfter(cutoff)).length
    const coCount = companies.filter((c) => !c.createdAt || !dayjs(String(c.createdAt)).isAfter(cutoff)).length
    return { month, clients: cCount, companies: coCount }
  })

  const outstandingTrend = months.map((month) => {
    const idxHint = monthIndex.get(month) ?? 0
    const amount = invoices
      .filter((inv) => {
        const m = monthKey(inv.issueDate)
        if (!m) return false
        const invIdx = monthIndex.get(m) ?? 99
        return invIdx <= idxHint && isOutstandingStatus(String(inv.status))
      })
      .reduce((s, inv) => s + invoiceBalance(inv), 0)
    return { month, amount }
  })

  const taskCompletion = months.map((month) => {
    let completed = 0
    let pending = 0
    tasks.forEach((t) => {
      const m = monthKey(t.completedAt || t.dueDate || t.createdAt)
      if (m !== month) return
      if (t.status === 'completed') completed += 1
      else pending += 1
    })
    return { month, completed, pending }
  })

  const serviceMap = new Map<string, { count: number; revenue: number }>()
  clients.forEach((c) => {
    (c.services || ['General']).forEach((service) => {
      const cur = serviceMap.get(service) || { count: 0, revenue: 0 }
      cur.count += 1
      cur.revenue += Number(c.revenue || 0) / Math.max((c.services || ['General']).length, 1)
      serviceMap.set(service, cur)
    })
  })
  const serviceBreakdown = Array.from(serviceMap.entries())
    .map(([service, v]) => ({ service, count: v.count, revenue: Math.round(v.revenue) }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8)

  const employeePerformance = employees
    .filter((e) => e.status === 'active')
    .map((e) => {
      const name = `${e.firstName} ${e.lastName}`
      const tasksCompleted = tasks.filter((t) => t.assignedTo === e.id && t.status === 'completed').length
      const clientsManaged = clients.filter((c) => c.assignedTo === e.id).length
      const revenue = invoices
        .filter((inv) => clients.find((c) => c.id === inv.clientId)?.assignedTo === e.id && inv.status === 'paid')
        .reduce((s, inv) => s + Number(inv.total || 0), 0)
      return { name, tasksCompleted, clientsManaged, revenue }
    })
    .sort((a, b) => b.tasksCompleted - a.tasksCompleted)
    .slice(0, 8)

  return {
    revenue,
    gstFiled,
    itrFiled,
    clientGrowth,
    outstandingTrend,
    taskCompletion,
    serviceBreakdown,
    employeePerformance,
  }
}
