import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const mockDir = join(__dirname, '..', 'src', 'mock')
mkdirSync(mockDir, { recursive: true })

const companies = [
  'Infosys Ltd', 'TCS', 'Reliance Industries', 'HDFC Bank', 'Mahindra & Mahindra',
  'L&T', 'Sun Pharma', 'Wipro', 'Adani Enterprises', 'Tata Steel',
  'ICICI Bank', 'Bharti Airtel', 'HCL Technologies', 'Asian Paints', 'Maruti Suzuki',
  'Axis Bank', 'Kotak Mahindra Bank', 'Bajaj Finance', 'Titan Company', 'UltraTech Cement',
  'Nestle India', 'Power Grid Corp', 'NTPC', 'Coal India', 'ONGC',
  'SBI', 'ITC Ltd', 'Hindustan Unilever', 'Britannia Industries', 'Godrej Consumer',
  'Pidilite Industries', 'Dabur India', 'Berger Paints', 'Cipla', 'Dr Reddys Labs',
  'Divis Laboratories', 'Apollo Hospitals', 'Zomato', 'Paytm', 'Nykaa',
  'Policybazaar', 'Delhivery', 'Mphasis', 'Persistent Systems', 'Coforge',
  'LTIMindtree', 'Tech Mahindra', 'Birla Soft', 'Cyient', 'Zensar Technologies',
  'RPG Enterprises', 'Voltas', 'Blue Star', 'Crompton Greaves', 'Havells India',
  'Polycab India', 'KEI Industries', 'Amber Enterprises', 'Dixon Technologies', 'Apar Industries',
  'Shree Cement', 'Ambuja Cements', 'ACC Ltd', 'JK Cement', 'Ramco Cements',
  'Tata Consumer', 'Marico', 'Emami Ltd', 'Jubilant Foodworks', 'Westlife Development',
  'Indian Hotels', 'Lemon Tree Hotels', 'Chalet Hotels', 'EIH Ltd', 'IRCTC',
  'IRFC', 'RVNL', 'Rail Vikas Nigam', 'BHEL', 'BEL',
  'HAL', 'Garden Reach Shipbuilders', 'Mazagon Dock', 'Cochin Shipyard', 'SJVN',
  'NHPC', 'SJVN Ltd', 'Torrent Power', 'Tata Power', 'Adani Power',
  'JSW Steel', 'Jindal Steel', 'SAIL', 'Hindalco', 'Vedanta Ltd',
  'NMDC', 'MOIL', 'Nalco', 'Hindustan Zinc', 'National Aluminium',
  'GAIL', 'Petronet LNG', 'Indraprastha Gas', 'Mahanagar Gas', 'Gujarat Gas',
  'Star Health', 'Max Healthcare', 'Fortis Healthcare', 'Narayana Hrudayalaya', 'Aster DM Healthcare',
]

const firstNames = ['Rajesh', 'Priya', 'Amit', 'Sneha', 'Vikram', 'Anita', 'Suresh', 'Kavita', 'Rahul', 'Meera', 'Arun', 'Deepa', 'Sanjay', 'Pooja', 'Manoj', 'Lakshmi', 'Karthik', 'Divya', 'Naveen', 'Shweta']
const lastNames = ['Sharma', 'Patel', 'Kumar', 'Reddy', 'Iyer', 'Nair', 'Gupta', 'Singh', 'Joshi', 'Desai', 'Mehta', 'Rao', 'Verma', 'Agarwal', 'Malhotra', 'Chopra', 'Bhat', 'Pillai', 'Menon', 'Shah']
const cities = ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Hyderabad', 'Pune', 'Ahmedabad', 'Kolkata', 'Jaipur', 'Lucknow', 'Surat', 'Indore', 'Nagpur', 'Kochi', 'Chandigarh']
const states = ['Maharashtra', 'Delhi', 'Karnataka', 'Tamil Nadu', 'Telangana', 'Gujarat', 'West Bengal', 'Rajasthan', 'Uttar Pradesh', 'Kerala', 'Punjab', 'Madhya Pradesh']
const services = ['GST Filing', 'ITR Filing', 'TDS Return', 'ROC Filing', 'Audit', 'Bookkeeping', 'Tax Planning', 'Company Registration', 'GST Registration', 'Trademark Filing']
const priorities = ['low', 'medium', 'high', 'urgent']
const statuses = ['upcoming', 'in_progress', 'waiting_client', 'completed']
const departments = ['Tax', 'Audit', 'Compliance', 'Accounts', 'Advisory', 'Legal']
const designations = ['Partner', 'Senior Manager', 'Manager', 'Senior Associate', 'Associate', 'Article Assistant', 'Intern']

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomDate(start, end) {
  const d = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()))
  return d.toISOString().split('T')[0]
}

function generatePAN() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  let pan = ''
  for (let i = 0; i < 5; i++) pan += chars[Math.floor(Math.random() * 26)]
  pan += String(Math.floor(Math.random() * 9000) + 1000)
  pan += chars[Math.floor(Math.random() * 26)]
  return pan
}

function generateGSTIN(stateCode) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let gstin = String(stateCode).padStart(2, '0')
  for (let i = 0; i < 10; i++) gstin += chars[Math.floor(Math.random() * chars.length)]
  gstin += 'Z'
  gstin += chars[Math.floor(Math.random() * 10) + 26]
  return gstin
}

function generatePhone() {
  return `+91 ${['98', '97', '96', '95', '94', '93', '91', '90', '89', '88'][Math.floor(Math.random() * 10)]}${String(Math.floor(Math.random() * 90000000) + 10000000)}`
}

// Employees
const employees = Array.from({ length: 25 }, (_, i) => {
  const fn = randomItem(firstNames)
  const ln = randomItem(lastNames)
  const dob = randomDate(new Date(1985, 0, 1), new Date(2000, 0, 1))
  return {
    id: `EMP-${String(i + 1).padStart(4, '0')}`,
    firstName: fn,
    lastName: ln,
    email: `${fn.toLowerCase()}.${ln.toLowerCase()}@smartca.in`,
    phone: generatePhone(),
    designation: randomItem(designations),
    department: randomItem(departments),
    dateOfJoining: randomDate(new Date(2015, 0, 1), new Date(2025, 0, 1)),
    dateOfBirth: dob,
    pan: generatePAN(),
    status: Math.random() > 0.1 ? 'active' : 'inactive',
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${fn}${ln}`,
    address: `${Math.floor(Math.random() * 500) + 1}, ${randomItem(['MG Road', 'Park Street', 'Brigade Road', 'Linking Road'])}, ${randomItem(cities)}`,
    salary: Math.floor(Math.random() * 800000) + 300000,
    permissions: ['read', 'write'],
    role: i === 0 ? 'admin' : i < 3 ? 'manager' : 'staff',
  }
})

// Clients (120)
const clients = Array.from({ length: 120 }, (_, i) => {
  const company = companies[i % companies.length] + (i >= companies.length ? ` ${Math.floor(i / companies.length) + 1}` : '')
  const city = randomItem(cities)
  const state = randomItem(states)
  const stateCode = Math.floor(Math.random() * 30) + 1
  const fn = randomItem(firstNames)
  const ln = randomItem(lastNames)
  const created = randomDate(new Date(2020, 0, 1), new Date(2025, 6, 1))
  return {
    id: `CLT-${String(i + 1).padStart(4, '0')}`,
    name: company,
    contactPerson: `${fn} ${ln}`,
    email: `accounts@${company.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
    phone: generatePhone(),
    pan: generatePAN(),
    gstin: generateGSTIN(stateCode),
    type: Math.random() > 0.3 ? 'company' : 'individual',
    status: Math.random() > 0.15 ? 'active' : Math.random() > 0.5 ? 'inactive' : 'prospect',
    address: `${Math.floor(Math.random() * 500) + 1}, ${randomItem(['Industrial Area', 'Business Park', 'Tech Park', 'Commercial Complex'])}, ${city}, ${state} - ${Math.floor(Math.random() * 900000) + 100000}`,
    city,
    state,
    pincode: String(Math.floor(Math.random() * 900000) + 100000),
    assignedTo: randomItem(employees).id,
    services: Array.from({ length: Math.floor(Math.random() * 4) + 1 }, () => randomItem(services)),
    revenue: Math.floor(Math.random() * 500000) + 50000,
    outstanding: Math.floor(Math.random() * 100000),
    createdAt: created,
    updatedAt: randomDate(new Date(created), new Date()),
    notes: `Client onboarded for ${randomItem(services)} services.`,
    tags: [randomItem(['premium', 'regular', 'new', 'vip', 'referral'])],
  }
})

// Companies (subset of clients as registered companies)
const companyRecords = clients.filter((_, i) => i % 2 === 0).slice(0, 80).map((c, i) => ({
  id: `CMP-${String(i + 1).padStart(4, '0')}`,
  clientId: c.id,
  name: c.name,
  cin: `U${Math.floor(Math.random() * 90000) + 10000}${randomItem(['MH', 'DL', 'KA', 'TN', 'GJ'])}${new Date().getFullYear()}PTC${String(Math.floor(Math.random() * 900000) + 100000)}`,
  pan: c.pan,
  gstin: c.gstin,
  incorporationDate: randomDate(new Date(1990, 0, 1), new Date(2023, 0, 1)),
  registeredAddress: c.address,
  authorizedCapital: Math.floor(Math.random() * 10000000) + 100000,
  paidUpCapital: Math.floor(Math.random() * 5000000) + 100000,
  directors: Array.from({ length: Math.floor(Math.random() * 3) + 1 }, () => `${randomItem(firstNames)} ${randomItem(lastNames)}`),
  status: Math.random() > 0.1 ? 'active' : 'dissolved',
  financialYearEnd: '31-03',
  industry: randomItem(['IT', 'Manufacturing', 'Pharma', 'Banking', 'Retail', 'Real Estate', 'Healthcare', 'FMCG']),
  employees: Math.floor(Math.random() * 5000) + 10,
  turnover: Math.floor(Math.random() * 500000000) + 1000000,
}))

// Invoices (150)
const invoices = Array.from({ length: 150 }, (_, i) => {
  const client = randomItem(clients)
  const amount = Math.floor(Math.random() * 200000) + 5000
  const tax = Math.round(amount * 0.18)
  const issueDate = randomDate(new Date(2024, 0, 1), new Date(2025, 6, 1))
  const dueDate = randomDate(new Date(issueDate), new Date(2025, 11, 31))
  const status = randomItem(['draft', 'sent', 'paid', 'overdue', 'cancelled'])
  return {
    id: `INV-${String(i + 1).padStart(5, '0')}`,
    invoiceNumber: `SCA/2025-26/${String(i + 1).padStart(4, '0')}`,
    clientId: client.id,
    clientName: client.name,
    issueDate,
    dueDate,
    status,
    items: [{
      description: randomItem(services),
      quantity: 1,
      rate: amount,
      amount,
    }],
    subtotal: amount,
    cgst: tax / 2,
    sgst: tax / 2,
    total: amount + tax,
    paidAmount: status === 'paid' ? amount + tax : status === 'sent' ? Math.floor(Math.random() * (amount + tax)) : 0,
    notes: 'Professional fees for CA services rendered.',
    createdBy: randomItem(employees).id,
    createdAt: issueDate,
  }
})

// Payments (120)
const payments = Array.from({ length: 120 }, (_, i) => {
  const invoice = randomItem(invoices.filter(inv => inv.status !== 'cancelled'))
  const amount = Math.floor(Math.random() * invoice.total) + 1000
  return {
    id: `PAY-${String(i + 1).padStart(5, '0')}`,
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    clientId: invoice.clientId,
    clientName: invoice.clientName,
    amount: Math.min(amount, invoice.total),
    paymentDate: randomDate(new Date(invoice.issueDate), new Date()),
    method: randomItem(['bank_transfer', 'cheque', 'upi', 'cash', 'neft', 'rtgs']),
    reference: `TXN${String(Math.floor(Math.random() * 900000000) + 100000000)}`,
    status: randomItem(['completed', 'pending', 'failed']),
    notes: '',
    recordedBy: randomItem(employees).id,
  }
})

// GST filings (100)
const gstFilings = Array.from({ length: 100 }, (_, i) => {
  const client = randomItem(clients.filter(c => c.gstin))
  const period = `0${Math.floor(Math.random() * 12) + 1}-2025`.slice(-7)
  return {
    id: `GST-${String(i + 1).padStart(4, '0')}`,
    clientId: client.id,
    clientName: client.name,
    gstin: client.gstin,
    returnType: randomItem(['GSTR-1', 'GSTR-3B', 'GSTR-9', 'GSTR-9C']),
    period,
    dueDate: randomDate(new Date(2025, 0, 1), new Date(2025, 11, 31)),
    filedDate: Math.random() > 0.3 ? randomDate(new Date(2025, 0, 1), new Date()) : null,
    status: randomItem(['filed', 'pending', 'overdue', 'draft']),
    turnover: Math.floor(Math.random() * 50000000) + 100000,
    taxLiability: Math.floor(Math.random() * 500000) + 10000,
    assignedTo: randomItem(employees).id,
    priority: randomItem(priorities),
  }
})

// ITR filings (80)
const itrFilings = Array.from({ length: 80 }, (_, i) => {
  const client = randomItem(clients)
  const ay = '2025-26'
  return {
    id: `ITR-${String(i + 1).padStart(4, '0')}`,
    clientId: client.id,
    clientName: client.name,
    pan: client.pan,
    assessmentYear: ay,
    itrForm: randomItem(['ITR-1', 'ITR-2', 'ITR-3', 'ITR-4', 'ITR-5', 'ITR-6']),
    dueDate: '2025-07-31',
    filedDate: Math.random() > 0.4 ? randomDate(new Date(2025, 3, 1), new Date()) : null,
    status: randomItem(['filed', 'pending', 'overdue', 'in_review']),
    totalIncome: Math.floor(Math.random() * 10000000) + 500000,
    taxPayable: Math.floor(Math.random() * 500000) + 10000,
    refund: Math.floor(Math.random() * 100000),
    assignedTo: randomItem(employees).id,
    priority: randomItem(priorities),
  }
})

// TDS (60)
const tdsRecords = Array.from({ length: 60 }, (_, i) => {
  const client = randomItem(clients)
  const quarter = randomItem(['Q1', 'Q2', 'Q3', 'Q4'])
  return {
    id: `TDS-${String(i + 1).padStart(4, '0')}`,
    clientId: client.id,
    clientName: client.name,
    tan: `${randomItem(['MUM', 'DEL', 'BLR', 'CHE', 'HYD'])}${String(Math.floor(Math.random() * 90000) + 10000)}A`,
    quarter,
    financialYear: '2025-26',
    form: randomItem(['24Q', '26Q', '27Q', '27EQ']),
    dueDate: randomDate(new Date(2025, 0, 1), new Date(2025, 11, 31)),
    filedDate: Math.random() > 0.35 ? randomDate(new Date(2025, 0, 1), new Date()) : null,
    status: randomItem(['filed', 'pending', 'overdue']),
    tdsAmount: Math.floor(Math.random() * 500000) + 5000,
    assignedTo: randomItem(employees).id,
  }
})

// ROC (50)
const rocFilings = Array.from({ length: 50 }, (_, i) => {
  const company = randomItem(companyRecords)
  return {
    id: `ROC-${String(i + 1).padStart(4, '0')}`,
    companyId: company.id,
    companyName: company.name,
    cin: company.cin,
    formType: randomItem(['AOC-4', 'MGT-7', 'DIR-3 KYC', 'ADT-1', 'INC-22A']),
    dueDate: randomDate(new Date(2025, 0, 1), new Date(2025, 11, 31)),
    filedDate: Math.random() > 0.4 ? randomDate(new Date(2025, 0, 1), new Date()) : null,
    status: randomItem(['filed', 'pending', 'overdue', 'in_progress']),
    assignedTo: randomItem(employees).id,
    priority: randomItem(priorities),
    financialYear: '2024-25',
  }
})

// Compliance Kanban (80)
const complianceRecords = Array.from({ length: 80 }, (_, i) => {
  const client = randomItem(clients)
  return {
    id: `CMP-${String(i + 1).padStart(4, '0')}`,
    clientId: client.id,
    clientName: client.name,
    service: randomItem(services),
    priority: randomItem(priorities),
    assignedTo: randomItem(employees).id,
    assignedToName: `${randomItem(employees).firstName} ${randomItem(employees).lastName}`,
    dueDate: randomDate(new Date(2025, 0, 1), new Date(2025, 11, 31)),
    status: randomItem(statuses),
    description: `${randomItem(services)} for ${client.name}`,
    createdAt: randomDate(new Date(2024, 6, 1), new Date()),
    tags: [randomItem(['monthly', 'quarterly', 'annual', 'urgent'])],
  }
})

// Documents (100)
const docTypes = ['invoice', 'receipt', 'gst_return', 'itr', 'audit_report', 'agreement', 'pan_card', 'bank_statement', 'balance_sheet', 'other']
const documents = Array.from({ length: 100 }, (_, i) => {
  const client = randomItem(clients)
  const type = randomItem(docTypes)
  return {
    id: `DOC-${String(i + 1).padStart(4, '0')}`,
    name: `${type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} - ${client.name}`,
    clientId: client.id,
    clientName: client.name,
    type,
    folder: randomItem(['GST Returns', 'ITR Documents', 'Audit Reports', 'Agreements', 'Bank Statements', 'Invoices', 'Receipts']),
    size: Math.floor(Math.random() * 5000000) + 10000,
    mimeType: randomItem(['application/pdf', 'application/vnd.ms-excel', 'image/jpeg', 'image/png']),
    uploadedBy: randomItem(employees).id,
    uploadedAt: randomDate(new Date(2024, 0, 1), new Date()),
    tags: [randomItem(['verified', 'pending_review', 'archived', 'important'])],
    status: randomItem(['active', 'archived']),
  }
})

// Tasks (100)
const tasks = Array.from({ length: 100 }, (_, i) => {
  const client = randomItem(clients)
  return {
    id: `TSK-${String(i + 1).padStart(4, '0')}`,
    title: `${randomItem(services)} - ${client.name}`,
    description: `Complete ${randomItem(services)} for ${client.name}`,
    clientId: client.id,
    clientName: client.name,
    assignedTo: randomItem(employees).id,
    assignedToName: `${randomItem(employees).firstName} ${randomItem(employees).lastName}`,
    dueDate: randomDate(new Date(2025, 0, 1), new Date(2025, 11, 31)),
    priority: randomItem(priorities),
    status: randomItem(['todo', 'in_progress', 'review', 'completed', 'cancelled']),
    category: randomItem(['compliance', 'billing', 'documentation', 'follow_up', 'meeting']),
    createdAt: randomDate(new Date(2024, 6, 1), new Date()),
    completedAt: Math.random() > 0.5 ? randomDate(new Date(2025, 0, 1), new Date()) : null,
  }
})

// Activities (50)
const activityTypes = ['invoice_created', 'payment_received', 'gst_filed', 'itr_filed', 'client_added', 'document_uploaded', 'task_completed', 'compliance_updated']
const activities = Array.from({ length: 50 }, (_, i) => {
  const type = randomItem(activityTypes)
  const client = randomItem(clients)
  const emp = randomItem(employees)
  const messages = {
    invoice_created: `Invoice created for ${client.name}`,
    payment_received: `Payment received from ${client.name}`,
    gst_filed: `GST return filed for ${client.name}`,
    itr_filed: `ITR filed for ${client.name}`,
    client_added: `New client ${client.name} added`,
    document_uploaded: `Document uploaded for ${client.name}`,
    task_completed: `Task completed for ${client.name}`,
    compliance_updated: `Compliance status updated for ${client.name}`,
  }
  return {
    id: `ACT-${String(i + 1).padStart(4, '0')}`,
    type,
    message: messages[type],
    clientId: client.id,
    clientName: client.name,
    userId: emp.id,
    userName: `${emp.firstName} ${emp.lastName}`,
    timestamp: randomDate(new Date(2025, 5, 1), new Date()) + 'T' + String(Math.floor(Math.random() * 12) + 9).padStart(2, '0') + ':' + String(Math.floor(Math.random() * 60)).padStart(2, '0') + ':00Z',
  }
})

// Notifications (30)
const notifications = Array.from({ length: 30 }, (_, i) => ({
  id: `NOT-${String(i + 1).padStart(4, '0')}`,
  title: randomItem(['GST Due Reminder', 'Payment Received', 'New Task Assigned', 'ITR Deadline', 'Document Uploaded', 'Client Meeting']),
  message: randomItem([
    'GSTR-3B filing due in 3 days for Infosys Ltd',
    'Payment of ₹45,000 received from TCS',
    'New compliance task assigned to you',
    'ITR filing deadline approaching for 5 clients',
    'Audit report uploaded for Reliance Industries',
    'Client meeting scheduled for tomorrow at 11 AM',
  ]),
  type: randomItem(['info', 'warning', 'success', 'error']),
  read: Math.random() > 0.4,
  createdAt: randomDate(new Date(2025, 5, 1), new Date()) + 'T' + String(Math.floor(Math.random() * 12) + 9).padStart(2, '0') + ':00:00Z',
  link: randomItem(['/compliance', '/invoices', '/tasks', '/clients']),
}))

// Calendar events (40)
const calendar = Array.from({ length: 40 }, (_, i) => ({
  id: `CAL-${String(i + 1).padStart(4, '0')}`,
  title: randomItem(['GST Filing Deadline', 'Client Meeting', 'Team Review', 'ITR Filing', 'Board Meeting', 'Audit Discussion', 'Tax Planning Session']),
  date: randomDate(new Date(2025, 5, 1), new Date(2025, 11, 31)),
  time: `${String(Math.floor(Math.random() * 8) + 9).padStart(2, '0')}:00`,
  duration: randomItem([30, 60, 90, 120]),
  type: randomItem(['deadline', 'meeting', 'reminder', 'holiday']),
  clientId: Math.random() > 0.3 ? randomItem(clients).id : null,
  clientName: Math.random() > 0.3 ? randomItem(clients).name : null,
  assignedTo: randomItem(employees).id,
  color: randomItem(['#6366f1', '#10b981', '#f97316', '#ef4444', '#8b5cf6']),
}))

// Reports data
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const reports = {
  revenue: months.map((month, i) => ({
    month,
    revenue: Math.floor(Math.random() * 500000) + 200000,
    expenses: Math.floor(Math.random() * 200000) + 50000,
    profit: 0,
  })).map(r => ({ ...r, profit: r.revenue - r.expenses })),
  gstFiled: months.map(month => ({
    month,
    filed: Math.floor(Math.random() * 30) + 10,
    pending: Math.floor(Math.random() * 10) + 2,
    overdue: Math.floor(Math.random() * 5),
  })),
  itrFiled: months.map(month => ({
    month,
    filed: Math.floor(Math.random() * 20) + 5,
    pending: Math.floor(Math.random() * 8) + 1,
  })),
  clientGrowth: months.map((month, i) => ({
    month,
    clients: 80 + i * 3 + Math.floor(Math.random() * 5),
    companies: 40 + i * 2 + Math.floor(Math.random() * 3),
  })),
  outstandingTrend: months.map(month => ({
    month,
    amount: Math.floor(Math.random() * 500000) + 100000,
  })),
  taskCompletion: months.map(month => ({
    month,
    completed: Math.floor(Math.random() * 40) + 20,
    pending: Math.floor(Math.random() * 15) + 5,
  })),
  serviceBreakdown: services.map(service => ({
    service,
    count: Math.floor(Math.random() * 50) + 10,
    revenue: Math.floor(Math.random() * 1000000) + 100000,
  })),
  employeePerformance: employees.slice(0, 10).map(emp => ({
    name: `${emp.firstName} ${emp.lastName}`,
    tasksCompleted: Math.floor(Math.random() * 30) + 5,
    clientsManaged: Math.floor(Math.random() * 15) + 3,
    revenue: Math.floor(Math.random() * 500000) + 50000,
  })),
}

// Dashboard
const totalRevenue = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.total, 0)
const totalOutstanding = invoices.filter(i => ['sent', 'overdue'].includes(i.status)).reduce((s, i) => s + (i.total - i.paidAmount), 0)
const dashboard = {
  kpis: {
    revenue: { value: totalRevenue, change: 12.5, trend: 'up' },
    outstanding: { value: totalOutstanding, change: -3.2, trend: 'down' },
    invoices: { value: invoices.length, change: 8.1, trend: 'up' },
    clients: { value: clients.filter(c => c.status === 'active').length, change: 5.4, trend: 'up' },
    companies: { value: companyRecords.filter(c => c.status === 'active').length, change: 3.2, trend: 'up' },
    pendingCompliance: { value: complianceRecords.filter(c => c.status !== 'completed').length, change: -2.1, trend: 'down' },
    upcomingDueDates: { value: complianceRecords.filter(c => new Date(c.dueDate) <= new Date(Date.now() + 7 * 86400000)).length, change: 0, trend: 'neutral' },
    employees: { value: employees.filter(e => e.status === 'active').length, change: 0, trend: 'neutral' },
  },
  recentActivity: activities.slice(0, 10),
  todaysTasks: tasks.filter(t => t.status !== 'completed').slice(0, 8),
  recentPayments: payments.filter(p => p.status === 'completed').slice(0, 6),
  upcomingDueDates: complianceRecords
    .filter(c => c.status !== 'completed')
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 8),
  birthdays: employees
    .filter(e => {
      const dob = new Date(e.dateOfBirth)
      const now = new Date()
      return dob.getMonth() === now.getMonth()
    })
    .slice(0, 5)
    .map(e => ({ ...e, daysUntil: Math.floor(Math.random() * 28) + 1 })),
  notifications: notifications.filter(n => !n.read).slice(0, 5),
}

// Chat history
const chatSessions = Array.from({ length: 10 }, (_, i) => ({
  id: `CHAT-${String(i + 1).padStart(3, '0')}`,
  title: randomItem([
    'GST filing requirements for FY 2025-26',
    'ITR computation for salaried individual',
    'TDS rate on professional fees',
    'ROC annual filing checklist',
    'Section 80C deduction limits',
    'GST input tax credit rules',
    'Advance tax calculation',
    'Company incorporation process',
  ]),
  createdAt: randomDate(new Date(2025, 0, 1), new Date()),
  messages: [
    { id: '1', role: 'user', content: 'What are the GST filing deadlines for Q1 FY 2025-26?', timestamp: new Date().toISOString() },
    { id: '2', role: 'assistant', content: 'For Q1 FY 2025-26 (April-June 2025):\n\n**GSTR-1**: 11th of the following month\n**GSTR-3B**: 20th of the following month\n**GSTR-9 (Annual)**: 31st December 2025\n\nFor businesses with turnover > ₹5 Cr, GSTR-1 must be filed by 11th and GSTR-3B by 20th of the following month.', timestamp: new Date().toISOString() },
  ],
}))

const files = {
  clients: { data: clients, total: clients.length },
  companies: { data: companyRecords, total: companyRecords.length },
  employees: { data: employees, total: employees.length },
  invoices: { data: invoices, total: invoices.length },
  payments: { data: payments, total: payments.length },
  gst: { data: gstFilings, total: gstFilings.length },
  itr: { data: itrFilings, total: itrFilings.length },
  tds: { data: tdsRecords, total: tdsRecords.length },
  roc: { data: rocFilings, total: rocFilings.length },
  documents: { data: documents, total: documents.length },
  dashboard,
  activities: { data: activities, total: activities.length },
  notifications: { data: notifications, total: notifications.length },
  tasks: { data: tasks, total: tasks.length },
  reports,
  calendar: { data: calendar, total: calendar.length },
  compliance: { data: complianceRecords, total: complianceRecords.length },
  chat: { sessions: chatSessions },
}

for (const [name, data] of Object.entries(files)) {
  writeFileSync(join(mockDir, `${name}.json`), JSON.stringify(data, null, 2))
  console.log(`Generated ${name}.json`)
}

console.log('Mock data generation complete!')
