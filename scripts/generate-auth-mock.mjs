import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const mockDir = join(__dirname, '..', 'src', 'mock')
mkdirSync(mockDir, { recursive: true })

const ROLES = [
  { id: 'super_admin', name: 'Super Admin', level: 100 },
  { id: 'admin', name: 'Admin', level: 90 },
  { id: 'partner', name: 'Partner', level: 80 },
  { id: 'ca', name: 'CA', level: 70 },
  { id: 'senior_ca', name: 'Senior CA', level: 65 },
  { id: 'junior_ca', name: 'Junior CA', level: 60 },
  { id: 'accountant', name: 'Accountant', level: 55 },
  { id: 'article_assistant', name: 'Article Assistant', level: 40 },
  { id: 'receptionist', name: 'Receptionist', level: 35 },
  { id: 'auditor', name: 'Auditor', level: 50 },
  { id: 'client', name: 'Client', level: 10 },
  { id: 'hr', name: 'HR', level: 45 },
  { id: 'finance', name: 'Finance', level: 55 },
  { id: 'employee', name: 'Employee', level: 30 },
]

const ALL_PERMISSIONS = [
  'dashboard.view', 'clients.view', 'clients.create', 'clients.edit', 'clients.delete',
  'companies.view', 'companies.create', 'companies.edit',
  'compliance.view', 'compliance.create', 'compliance.edit', 'compliance.delete',
  'gst.view', 'itr.view', 'tds.view', 'roc.view',
  'accounting.view', 'invoices.view', 'invoices.create', 'invoices.edit', 'invoices.delete',
  'payments.view', 'payments.create', 'documents.view', 'documents.upload', 'documents.delete',
  'tasks.view', 'tasks.create', 'tasks.edit', 'tasks.delete',
  'reports.view', 'reports.export', 'employees.view', 'employees.create', 'employees.edit',
  'ai.view', 'settings.view', 'settings.edit', 'settings.users', 'settings.roles',
  'settings.security', 'settings.branding', 'settings.api',
]

const ROLE_PERMISSIONS = {
  super_admin: ALL_PERMISSIONS,
  admin: ALL_PERMISSIONS.filter(p => !p.includes('settings.api')),
  partner: ['dashboard.view', 'clients.view', 'clients.create', 'clients.edit', 'companies.view', 'compliance.view', 'gst.view', 'itr.view', 'tds.view', 'roc.view', 'invoices.view', 'payments.view', 'documents.view', 'tasks.view', 'reports.view', 'reports.export', 'employees.view', 'ai.view', 'settings.view'],
  ca: ['dashboard.view', 'clients.view', 'clients.edit', 'companies.view', 'compliance.view', 'compliance.create', 'compliance.edit', 'gst.view', 'itr.view', 'tds.view', 'roc.view', 'documents.view', 'documents.upload', 'tasks.view', 'tasks.create', 'tasks.edit', 'ai.view'],
  senior_ca: ['dashboard.view', 'clients.view', 'compliance.view', 'compliance.create', 'compliance.edit', 'gst.view', 'itr.view', 'tds.view', 'roc.view', 'documents.view', 'documents.upload', 'tasks.view', 'tasks.create', 'tasks.edit', 'ai.view'],
  junior_ca: ['dashboard.view', 'clients.view', 'compliance.view', 'gst.view', 'itr.view', 'tds.view', 'documents.view', 'tasks.view', 'tasks.create', 'ai.view'],
  accountant: ['dashboard.view', 'clients.view', 'invoices.view', 'invoices.create', 'invoices.edit', 'payments.view', 'payments.create', 'documents.view', 'accounting.view'],
  article_assistant: ['dashboard.view', 'clients.view', 'compliance.view', 'documents.view', 'tasks.view', 'tasks.create'],
  receptionist: ['dashboard.view', 'clients.view', 'clients.create', 'tasks.view', 'documents.view'],
  auditor: ['dashboard.view', 'clients.view', 'companies.view', 'compliance.view', 'documents.view', 'reports.view'],
  client: ['dashboard.view', 'invoices.view', 'payments.view', 'documents.view'],
  hr: ['dashboard.view', 'employees.view', 'employees.create', 'employees.edit', 'tasks.view', 'settings.view'],
  finance: ['dashboard.view', 'invoices.view', 'payments.view', 'reports.view', 'reports.export', 'accounting.view'],
  employee: ['dashboard.view', 'tasks.view', 'tasks.create', 'documents.view'],
}

const firstNames = ['Rajesh', 'Priya', 'Amit', 'Sneha', 'Vikram', 'Anita', 'Suresh', 'Kavita', 'Rahul', 'Meera', 'Arun', 'Deepa', 'Sanjay', 'Pooja', 'Manoj', 'Lakshmi', 'Karthik', 'Divya', 'Naveen', 'Shweta', 'Rohan', 'Neha', 'Aditya', 'Kiran', 'Varun', 'Anjali', 'Gaurav', 'Ritu', 'Harsh', 'Isha']
const lastNames = ['Sharma', 'Patel', 'Kumar', 'Reddy', 'Iyer', 'Nair', 'Gupta', 'Singh', 'Joshi', 'Desai', 'Mehta', 'Rao', 'Verma', 'Agarwal', 'Malhotra', 'Chopra', 'Bhat', 'Pillai', 'Menon', 'Shah', 'Kapoor', 'Saxena', 'Tiwari', 'Mishra', 'Dubey', 'Pandey', 'Sethi', 'Khanna', 'Bose', 'Das']
const departments = ['Tax', 'Audit', 'Compliance', 'Accounts', 'Advisory', 'Legal', 'HR', 'Administration']
const designations = ['Partner', 'Senior Manager', 'Manager', 'Senior Associate', 'Associate', 'Article Assistant', 'Receptionist', 'HR Manager', 'Finance Manager']
const branches = ['Mumbai HQ', 'Delhi Branch', 'Bangalore Branch', 'Chennai Branch', 'Pune Branch']
const cities = ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Hyderabad', 'Pune', 'Ahmedabad', 'Kolkata']
const states = ['Maharashtra', 'Delhi', 'Karnataka', 'Tamil Nadu', 'Telangana', 'Gujarat', 'West Bengal']

function randomItem(arr) { return arr[Math.floor(Math.random() * arr.length)] }
function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime())).toISOString().split('T')[0]
}
function generatePAN() {
  const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  let p = ''
  for (let i = 0; i < 5; i++) p += c[Math.floor(Math.random() * 26)]
  return p + String(Math.floor(Math.random() * 9000) + 1000) + c[Math.floor(Math.random() * 26)]
}
function generateGSTIN() {
  const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let g = String(Math.floor(Math.random() * 30) + 1).padStart(2, '0')
  for (let i = 0; i < 10; i++) g += c[Math.floor(Math.random() * c.length)]
  return g + 'Z' + c[Math.floor(Math.random() * 10) + 26]
}

const roleAssignments = [
  'super_admin', 'admin', 'partner', 'partner', 'ca', 'ca', 'senior_ca', 'senior_ca', 'junior_ca', 'junior_ca',
  'accountant', 'accountant', 'article_assistant', 'article_assistant', 'receptionist', 'auditor', 'hr', 'finance',
  'employee', 'employee', 'ca', 'senior_ca', 'junior_ca', 'accountant', 'article_assistant', 'partner', 'admin',
  'ca', 'receptionist', 'client', 'client', 'employee',
]

const users = roleAssignments.map((roleId, i) => {
  const fn = firstNames[i % firstNames.length]
  const ln = lastNames[i % lastNames.length]
  const fullName = `${fn} ${ln}`
  const loginId = `${fn.toLowerCase().charAt(0)}${ln.toLowerCase()}${String(i + 1).padStart(2, '0')}`
  const username = `${fn.toLowerCase()}.${ln.toLowerCase()}`
  const email = `${username}@smartca.in`
  const role = ROLES.find(r => r.id === roleId) || ROLES[0]
  return {
    id: `USR-${String(i + 1).padStart(4, '0')}`,
    employeeId: `EMP-${String(i + 1).padStart(4, '0')}`,
    firstName: fn,
    lastName: ln,
    fullName,
    email,
    loginId,
    username,
    password: 'SmartCA@2025',
    mobile: `+91 ${['98', '97', '96', '95'][i % 4]}${String(Math.floor(Math.random() * 90000000) + 10000000)}`,
    designation: roleId === 'client' ? 'Client Contact' : randomItem(designations),
    department: roleId === 'client' ? 'External' : randomItem(departments),
    organization: 'Sharma & Associates Chartered Accountants',
    branch: randomItem(branches),
    role: roleId,
    roleName: role.name,
    permissions: ROLE_PERMISSIONS[roleId] || [],
    status: i === 30 ? 'inactive' : 'active',
    profileImage: `https://api.dicebear.com/7.x/avataaars/svg?seed=${fn}${ln}${i}`,
    joiningDate: randomDate(new Date(2015, 0, 1), new Date(2025, 0, 1)),
    lastLogin: randomDate(new Date(2025, 5, 1), new Date()) + 'T09:00:00Z',
    themePreference: randomItem(['light', 'dark', 'system']),
    language: randomItem(['en', 'hi']),
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${fn}${ln}${i}`,
    address: `${Math.floor(Math.random() * 500) + 1}, Business District`,
    city: randomItem(cities),
    state: randomItem(states),
    country: 'India',
    pincode: String(Math.floor(Math.random() * 900000) + 100000),
    gstin: generateGSTIN(),
    pan: generatePAN(),
    aadhaar: `XXXX-XXXX-${String(Math.floor(Math.random() * 9000) + 1000)}`,
    bio: `${role.name} at Sharma & Associates with expertise in tax and compliance.`,
  }
})

const permissions = ALL_PERMISSIONS.map(p => {
  const [module, action] = p.split('.')
  return { id: p, module, action, description: `${action.charAt(0).toUpperCase() + action.slice(1)} ${module}` }
})

const roles = ROLES.map(r => ({
  ...r,
  permissions: ROLE_PERMISSIONS[r.id] || [],
  userCount: users.filter(u => u.role === r.id).length,
}))

const organization = {
  id: 'ORG-001',
  name: 'Sharma & Associates Chartered Accountants',
  legalName: 'Sharma & Associates CA Firm LLP',
  registrationNumber: 'FRN-012345N',
  pan: 'AABCS1234F',
  gstin: '27AABCS1234F1Z5',
  email: 'info@smartca.in',
  phone: '+91 22 1234 5678',
  website: 'https://smartca.in',
  address: '501, Business Tower, Bandra Kurla Complex',
  city: 'Mumbai',
  state: 'Maharashtra',
  country: 'India',
  pincode: '400051',
  financialYearStart: '01-04',
  financialYearEnd: '31-03',
  currency: 'INR',
  timezone: 'Asia/Kolkata',
  logo: null,
  foundedYear: 1998,
  employeeCount: users.filter(u => u.role !== 'client').length,
  clientCount: 120,
  branches: branches.map((b, i) => ({ id: `BR-${i + 1}`, name: b, city: cities[i % cities.length] })),
}

const settings = {
  organization,
  branding: { primaryColor: '#4f46e5', logo: null, favicon: null, appName: 'Smart CA' },
  notifications: {
    email: { enabled: true, gstReminders: true, paymentAlerts: true, taskAssignments: true },
    sms: { enabled: false, provider: null },
    whatsapp: { enabled: false, provider: null },
    inApp: { enabled: true, sound: true },
  },
  security: { twoFactor: false, sessionTimeout: 30, ipWhitelist: false, passwordPolicy: { minLength: 8, requireSpecial: true } },
  email: { smtpHost: '', smtpPort: 587, fromEmail: 'noreply@smartca.in', fromName: 'Smart CA' },
  sms: { provider: 'twilio', apiKey: '', senderId: 'SMARTCA' },
  whatsapp: { provider: 'meta', apiKey: '', phoneNumberId: '' },
  apiKeys: [],
  appearance: { theme: 'system', language: 'en', sidebarCollapsed: false, compactMode: false },
}

const countries = [{ code: 'IN', name: 'India' }, { code: 'US', name: 'United States' }, { code: 'UK', name: 'United Kingdom' }]
const statesData = states.map((s, i) => ({ id: `ST-${i + 1}`, name: s, country: 'IN', code: s.substring(0, 2).toUpperCase() }))
const citiesData = cities.map((c, i) => ({ id: `CT-${i + 1}`, name: c, state: statesData[i % statesData.length].name }))
const departmentsData = departments.map((d, i) => ({ id: `DEP-${i + 1}`, name: d }))
const branchesData = branches.map((b, i) => ({ id: `BR-${i + 1}`, name: b, city: cities[i % cities.length] }))

const sessions = users.slice(0, 5).map((u, i) => ({
  id: `SES-${String(i + 1).padStart(4, '0')}`,
  userId: u.id,
  token: `session-token-${i + 1}`,
  device: randomItem(['Chrome on Windows', 'Safari on macOS', 'Firefox on Linux', 'Edge on Windows']),
  ip: `192.168.1.${100 + i}`,
  createdAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
  active: i === 0,
}))

const loginHistory = users.slice(0, 20).flatMap((u, i) => [
  { id: `LH-${i * 2 + 1}`, userId: u.id, userName: u.fullName, email: u.email, success: true, ip: `192.168.1.${i + 1}`, device: 'Chrome on Windows', timestamp: randomDate(new Date(2025, 5, 1), new Date()) + 'T10:00:00Z' },
  { id: `LH-${i * 2 + 2}`, userId: u.id, userName: u.fullName, email: u.email, success: Math.random() > 0.9 ? false : true, ip: `10.0.0.${i + 1}`, device: 'Mobile Safari', timestamp: randomDate(new Date(2025, 4, 1), new Date()) + 'T08:00:00Z' },
]).slice(0, 40)

const auditLogs = Array.from({ length: 50 }, (_, i) => ({
  id: `AUD-${String(i + 1).padStart(4, '0')}`,
  userId: randomItem(users).id,
  userName: randomItem(users).fullName,
  action: randomItem(['create', 'update', 'delete', 'view', 'export', 'login', 'logout']),
  module: randomItem(['clients', 'invoices', 'compliance', 'documents', 'settings', 'users']),
  details: randomItem(['Created new client', 'Updated invoice status', 'Filed GST return', 'Uploaded document', 'Changed settings', 'Logged in', 'Exported report']),
  ip: `192.168.1.${Math.floor(Math.random() * 255)}`,
  timestamp: randomDate(new Date(2025, 0, 1), new Date()) + 'T12:00:00Z',
}))

const activityLogs = auditLogs.map(a => ({ ...a, type: 'audit' }))

const modules = [
  { id: 'dashboard', name: 'Dashboard', path: '/', permission: 'dashboard.view' },
  { id: 'clients', name: 'Clients', path: '/clients', permission: 'clients.view' },
  { id: 'companies', name: 'Companies', path: '/companies', permission: 'companies.view' },
  { id: 'compliance', name: 'Compliance', path: '/compliance', permission: 'compliance.view' },
  { id: 'accounting', name: 'Accounting', path: '/accounting', permission: 'accounting.view' },
  { id: 'invoices', name: 'Invoices', path: '/invoices', permission: 'invoices.view' },
  { id: 'payments', name: 'Payments', path: '/payments', permission: 'payments.view' },
  { id: 'documents', name: 'Documents', path: '/documents', permission: 'documents.view' },
  { id: 'tasks', name: 'Tasks', path: '/tasks', permission: 'tasks.view' },
  { id: 'reports', name: 'Reports', path: '/reports', permission: 'reports.view' },
  { id: 'employees', name: 'Employees', path: '/employees', permission: 'employees.view' },
  { id: 'ai', name: 'AI Assistant', path: '/ai', permission: 'ai.view' },
  { id: 'settings', name: 'Settings', path: '/settings', permission: 'settings.view' },
]

const sidebar = modules.map(m => ({ ...m, icon: m.id, children: m.id === 'compliance' ? [
  { id: 'gst', name: 'GST', path: '/compliance/gst', permission: 'gst.view' },
  { id: 'itr', name: 'Income Tax', path: '/compliance/itr', permission: 'itr.view' },
  { id: 'tds', name: 'TDS', path: '/compliance/tds', permission: 'tds.view' },
  { id: 'roc', name: 'ROC', path: '/compliance/roc', permission: 'roc.view' },
] : undefined }))

const menu = sidebar

const files = {
  users: { data: users, total: users.length },
  roles: { data: roles, total: roles.length },
  permissions: { data: permissions, total: permissions.length },
  organization,
  settings,
  theme: { modes: ['light', 'dark', 'system'], default: 'system' },
  preferences: { defaultLanguage: 'en', dateFormat: 'DD MMM YYYY', currency: 'INR' },
  sessions: { data: sessions, total: sessions.length },
  loginHistory: { data: loginHistory, total: loginHistory.length },
  auditLogs: { data: auditLogs, total: auditLogs.length },
  activityLogs: { data: activityLogs, total: activityLogs.length },
  modules: { data: modules, total: modules.length },
  sidebar: { data: sidebar, total: sidebar.length },
  menu: { data: menu, total: menu.length },
  countries: { data: countries, total: countries.length },
  states: { data: statesData, total: statesData.length },
  cities: { data: citiesData, total: citiesData.length },
  departments: { data: departmentsData, total: departmentsData.length },
  branches: { data: branchesData, total: branchesData.length },
}

for (const [name, data] of Object.entries(files)) {
  writeFileSync(join(mockDir, `${name}.json`), JSON.stringify(data, null, 2))
  console.log(`Generated ${name}.json`)
}

console.log('Auth mock data generation complete!')
console.log('\nDemo credentials (all passwords: SmartCA@2025):')
console.log('  Super Admin: rajesh.sharma@smartca.in')
console.log('  Partner:     priya.patel@smartca.in')
console.log('  CA:          amit.kumar@smartca.in')
console.log('  Receptionist: sneha.reddy@smartca.in')
console.log('  Client:      rohan.kapoor@smartca.in')
