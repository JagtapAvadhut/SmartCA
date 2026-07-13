/**
 * Dev/QA surface for deterministic business-logic tests.
 * Exposed on window.__SMART_CA_QA__ after login (App.tsx).
 */
import { ClientService, InvoiceService, PaymentService, EmployeeService, TaskService } from '@/services'
import { computeDashboard, computeReports } from '@/services/analyticsService'
import { getAccountingSnapshot, postManualJournal, assertBalanced } from '@/services/accountingEngine'
import { runDataIntegrityCheck, repairDerivedData } from '@/services/reconciliationService'
import { http } from '@/services/httpClient'
import { invoiceRemaining } from '@/utils/money'

export const qaApi = {
  resetDatabase: async () => http.post('/demo/reset'),
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
  getClient: (id: string) => ClientService.getById(id),
  getInvoice: (id: string) => InvoiceService.getById(id),
  getPayment: (id: string) => PaymentService.getById(id),
  invoiceRemaining,
  async readOutstanding(clientId?: string) {
    const dash = await computeDashboard()
    const client = clientId ? await ClientService.getById(clientId).catch(() => null) : null
    return { dashboard: dash.kpis.outstanding.value, client: client?.outstanding ?? null }
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
