import { http } from './httpClient'
import type { DashboardData, ReportData } from '@/types'

export const DashboardService = {
  async getData(): Promise<DashboardData> {
    return http.get<DashboardData>('/dashboard')
  },
}

export const ReportService = {
  async getData(): Promise<ReportData> {
    return http.get<ReportData>('/reports/summary')
  },
}
