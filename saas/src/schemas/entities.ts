import { z } from 'zod'

const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]$/
const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/
const phoneRegex = /^(\+91[\s-]?)?[6-9]\d{9}$/

export const panSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(10, 'PAN must be 10 characters')
  .max(10, 'PAN must be 10 characters')
  .regex(panRegex, 'Invalid PAN format (e.g. ABCDE1234F)')

export const gstinSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(15, 'GSTIN must be 15 characters')
  .max(15, 'GSTIN must be 15 characters')
  .regex(gstinRegex, 'Invalid GSTIN format')

export const phoneSchema = z
  .string()
  .trim()
  .min(10, 'Enter a valid 10-digit mobile number')
  .regex(phoneRegex, 'Enter a valid Indian mobile number')

export const clientSchema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(120, 'Name is too long'),
  contactPerson: z.string().trim().min(2, 'Contact person is required').max(80),
  email: z.string().trim().email('Enter a valid email address').max(120),
  phone: phoneSchema,
  pan: panSchema,
  gstin: gstinSchema,
  type: z.enum(['company', 'individual']),
  status: z.enum(['active', 'inactive', 'prospect']),
  city: z.string().trim().min(1, 'City is required').max(60),
  state: z.string().trim().min(1, 'State is required').max(60),
  address: z.string().max(250).optional(),
  pincode: z.string().max(6).optional(),
  notes: z.string().max(500).optional(),
})

/** Derived display names are filled from select labels before/during submit. */
const derivedName = z.string().optional().default('')

export const invoiceSchema = z.object({
  clientId: z.string().min(1, 'Client is required'),
  clientName: derivedName,
  subtotal: z.coerce.number().min(1, 'Amount must be greater than 0').max(100000000),
  status: z.enum(['draft', 'sent', 'partially_paid', 'paid', 'overdue', 'cancelled']),
  issueDate: z.string().min(1, 'Issue date is required'),
  dueDate: z.string().min(1, 'Due date is required'),
  notes: z.string().max(500).optional(),
}).refine((d) => d.dueDate >= d.issueDate, {
  message: 'Due date cannot be before issue date',
  path: ['dueDate'],
})

export const paymentSchema = z.object({
  clientId: z.string().min(1, 'Client is required'),
  clientName: derivedName,
  invoiceId: z.string().min(1, 'Invoice is required'),
  invoiceNumber: derivedName,
  amount: z.coerce.number().min(1, 'Amount must be greater than 0').max(100000000),
  paymentDate: z.string().min(1),
  method: z.enum(['bank_transfer', 'cheque', 'upi', 'cash', 'neft', 'rtgs']),
  status: z.enum(['completed', 'pending', 'failed']),
  reference: z.string().max(60).optional(),
  notes: z.string().max(500).optional(),
})

export const taskSchema = z.object({
  title: z.string().trim().min(2, 'Title is required').max(160),
  description: z.string().max(1000).optional(),
  clientId: z.string().min(1, 'Client is required'),
  clientName: derivedName,
  assignedTo: z.string().optional(),
  assignedToName: z.string().max(80).optional(),
  dueDate: z.string().min(1, 'Due date is required'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  status: z.enum(['todo', 'in_progress', 'review', 'completed', 'cancelled']),
  category: z.enum(['compliance', 'billing', 'documentation', 'follow_up', 'meeting']),
})

export const employeeSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(50),
  lastName: z.string().trim().min(1, 'Last name is required').max(50),
  email: z.string().trim().email('Enter a valid email').max(120),
  phone: phoneSchema,
  designation: z.string().trim().min(1, 'Designation is required').max(80),
  department: z.string().trim().min(1, 'Department is required'),
  status: z.enum(['active', 'inactive']),
  role: z.enum(['admin', 'manager', 'staff']),
  dateOfJoining: z.string().min(1),
  pan: z.union([panSchema, z.literal('')]).optional(),
})

export const companySchema = z.object({
  name: z.string().trim().min(2, 'Company name is required').max(120),
  clientId: z.string().min(1, 'Linked client is required'),
  cin: z.string().trim().min(5, 'CIN is required').max(21),
  pan: panSchema,
  gstin: gstinSchema,
  industry: z.string().min(1),
  status: z.enum(['active', 'inactive', 'dissolved']),
  incorporationDate: z.string().min(1),
  turnover: z.coerce.number().min(0).optional(),
})

export const documentSchema = z.object({
  name: z.string().trim().min(2, 'Document name is required').max(160),
  clientId: z.string().min(1, 'Client is required'),
  clientName: derivedName,
  type: z.string().min(1),
  folder: z.string().min(1),
  tags: z.string().max(120).optional(),
})

export const complianceSchema = z.object({
  clientId: z.string().min(1),
  clientName: derivedName,
  service: z.string().min(1),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  status: z.enum(['upcoming', 'in_progress', 'waiting_client', 'completed']),
  dueDate: z.string().min(1),
  assignedToName: z.string().optional(),
  assignedTo: z.string().optional(),
  description: z.string().max(500).optional(),
})

export type ClientForm = z.infer<typeof clientSchema>
export type InvoiceForm = z.infer<typeof invoiceSchema>
export type PaymentForm = z.infer<typeof paymentSchema>
export type TaskForm = z.infer<typeof taskSchema>
export type EmployeeForm = z.infer<typeof employeeSchema>
export type CompanyForm = z.infer<typeof companySchema>
export type DocumentForm = z.infer<typeof documentSchema>
export type ComplianceForm = z.infer<typeof complianceSchema>
