/**
 * Analytics helpers — dashboard/report aggregates live on the Go API.
 * Kept for QA / callers that previously used LocalStorage-derived KPIs.
 */
import { http } from './httpClient'
import type { DashboardData, ReportData } from '@/types'

export async function computeDashboard(): Promise<DashboardData> {
  return http.get<DashboardData>('/dashboard')
}

export async function computeReports(): Promise<ReportData> {
  return http.get<ReportData>('/reports/summary')
}
