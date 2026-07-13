export type Status =
  | 'active' | 'inactive' | 'prospect' | 'dissolved'
  | 'draft' | 'sent' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled'
  | 'pending' | 'filed' | 'in_progress' | 'in_review'
  | 'waiting_client' | 'completed' | 'upcoming'
  | 'todo' | 'review' | 'failed'

export type Priority = 'low' | 'medium' | 'high' | 'urgent'

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
}

export interface KPI {
  value: number
  change: number
  trend: 'up' | 'down' | 'neutral'
}

export interface Client {
  id: string
  name: string
  contactPerson: string
  email: string
  phone: string
  pan: string
  gstin: string
  type: 'company' | 'individual'
  status: Status
  address: string
  city: string
  state: string
  pincode: string
  assignedTo: string
  services: string[]
  revenue: number
  outstanding: number
  createdAt: string
  updatedAt: string
  notes: string
  tags: string[]
}

export interface Company {
  id: string
  clientId: string
  name: string
  cin: string
  pan: string
  gstin: string
  incorporationDate: string
  registeredAddress: string
  authorizedCapital: number
  paidUpCapital: number
  directors: string[]
  status: Status
  financialYearEnd: string
  industry: string
  employees: number
  turnover: number
}

export interface Employee {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  designation: string
  department: string
  dateOfJoining: string
  dateOfBirth: string
  pan: string
  status: Status
  avatar: string
  address: string
  salary: number
  permissions: string[]
  role: 'admin' | 'manager' | 'staff'
}

export interface InvoiceItem {
  description: string
  quantity: number
  rate: number
  amount: number
}

export interface Invoice {
  id: string
  invoiceNumber: string
  clientId: string
  clientName: string
  issueDate: string
  dueDate: string
  status: Status
  items: InvoiceItem[]
  subtotal: number
  cgst: number
  sgst: number
  igst?: number
  discount?: number
  roundOff?: number
  total: number
  paidAmount: number
  /** Derived: total - paidAmount (persisted for UI/reports) */
  remainingAmount?: number
  notes: string
  createdBy: string
  createdAt: string
}

export interface Payment {
  id: string
  invoiceId: string
  invoiceNumber: string
  clientId: string
  clientName: string
  amount: number
  paymentDate: string
  method: string
  reference: string
  status: Status
  notes: string
  recordedBy: string
}

export interface GSTFiling {
  id: string
  clientId: string
  clientName: string
  gstin: string
  returnType: string
  period: string
  dueDate: string
  filedDate: string | null
  status: Status
  turnover: number
  taxLiability: number
  assignedTo: string
  priority: Priority
}

export interface ITRFiling {
  id: string
  clientId: string
  clientName: string
  pan: string
  assessmentYear: string
  itrForm: string
  dueDate: string
  filedDate: string | null
  status: Status
  totalIncome: number
  taxPayable: number
  refund: number
  assignedTo: string
  priority: Priority
}

export interface TDSRecord {
  id: string
  clientId: string
  clientName: string
  tan: string
  quarter: string
  financialYear: string
  form: string
  dueDate: string
  filedDate: string | null
  status: Status
  tdsAmount: number
  assignedTo: string
}

export interface ROCFiling {
  id: string
  companyId: string
  companyName: string
  cin: string
  formType: string
  dueDate: string
  filedDate: string | null
  status: Status
  assignedTo: string
  priority: Priority
  financialYear: string
}

export interface ComplianceRecord {
  id: string
  clientId: string
  clientName: string
  service: string
  priority: Priority
  assignedTo: string
  assignedToName: string
  dueDate: string
  status: Status
  description: string
  createdAt: string
  tags: string[]
}

export interface DocumentVersion {
  version: number
  name: string
  uploadedAt: string
  uploadedBy: string
  size: number
  note?: string
}

export interface Document {
  id: string
  name: string
  clientId: string
  clientName: string
  type: string
  folder: string
  size: number
  mimeType: string
  uploadedBy: string
  uploadedAt: string
  tags: string[]
  status: Status
  archived?: boolean
  favourite?: boolean
  versions?: DocumentVersion[]
  contentPreview?: string
}

export interface Task {
  id: string
  title: string
  description: string
  clientId: string
  clientName: string
  assignedTo: string
  assignedToName: string
  dueDate: string
  priority: Priority
  status: Status
  category: string
  createdAt: string
  completedAt: string | null
}

export interface Activity {
  id: string
  type: string
  message: string
  clientId: string
  clientName: string
  userId: string
  userName: string
  timestamp: string
}

export interface Notification {
  id: string
  title: string
  message: string
  type: 'info' | 'warning' | 'success' | 'error'
  read: boolean
  createdAt: string
  link: string
}

export interface CalendarEvent {
  id: string
  title: string
  date: string
  time: string
  duration: number
  type: string
  clientId: string | null
  clientName: string | null
  assignedTo: string
  color: string
}

export interface DashboardData {
  kpis: Record<string, KPI>
  recentActivity: Activity[]
  todaysTasks: Task[]
  recentPayments: Payment[]
  upcomingDueDates: ComplianceRecord[]
  birthdays: (Employee & { daysUntil: number })[]
  notifications: Notification[]
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export interface ChatSession {
  id: string
  title: string
  createdAt: string
  messages: ChatMessage[]
}

export interface ReportData {
  revenue: { month: string; revenue: number; expenses: number; profit: number }[]
  gstFiled: { month: string; filed: number; pending: number; overdue: number }[]
  itrFiled: { month: string; filed: number; pending: number }[]
  clientGrowth: { month: string; clients: number; companies: number }[]
  outstandingTrend: { month: string; amount: number }[]
  taskCompletion: { month: string; completed: number; pending: number }[]
  serviceBreakdown: { service: string; count: number; revenue: number }[]
  employeePerformance: { name: string; tasksCompleted: number; clientsManaged: number; revenue: number }[]
}

export * from './auth'
