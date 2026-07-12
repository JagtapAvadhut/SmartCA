/**
 * Dev/QA surface for deterministic business-logic tests.
 * Exposed on window.__SMART_CA_QA__ after login (App.tsx).
 */
import { ClientService, InvoiceService, PaymentService, EmployeeService, TaskService } from '@/services'
import { computeDashboard, computeReports } from '@/services/analyticsService'
import { getAccountingSnapshot, postManualJournal, assertBalanced } from '@/services/accountingEngine'
import { runDataIntegrityCheck, repairDerivedData } from '@/services/reconciliationService'
import { COLLECTION, getCollection, resetDatabase } from '@/db'
import { invoiceRemaining } from '@/utils/money'
import type { Client, Invoice, Payment } from '@/types'

export const qaApi = {
  resetDatabase,
  ClientService,
  InvoiceService,
  PaymentService,
  EmployeeService,
  TaskService,
  computeDashboard,
  computeReports,
  getAccountingSnapshot,
  postManualJournal,
  assertBalanced,
  runDataIntegrityCheck,
  repairDerivedData,
  getClient: (id: string) => getCollection<Client>(COLLECTION.clients).findById(id),
  getInvoice: (id: string) => getCollection<Invoice>(COLLECTION.invoices).findById(id),
  getPayment: (id: string) => getCollection<Payment>(COLLECTION.payments).findById(id),
  invoiceRemaining,
  /** Snapshot outstanding from dashboard + named client */
  readOutstanding(clientId?: string) {
    const dash = computeDashboard().kpis.outstanding.value
    const client = clientId ? getCollection<Client>(COLLECTION.clients).findById(clientId) : null
    return { dashboard: dash, client: client?.outstanding ?? null }
  },
}

export type QaApi = typeof qaApi

declare global {
  interface Window {
    __SMART_CA_QA__?: QaApi
  }
}

export function exposeQaApi() {
  if (typeof window !== 'undefined') {
    window.__SMART_CA_QA__ = qaApi
  }
}
