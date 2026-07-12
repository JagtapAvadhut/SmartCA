import { simulateDelay } from './api'
import { computeDashboard, computeReports } from './analyticsService'
import type { DashboardData, ReportData } from '@/types'

export const DashboardService = {
  async getData(): Promise<DashboardData> {
    await simulateDelay(120)
    return computeDashboard()
  },
}

export const ReportService = {
  async getData(): Promise<ReportData> {
    await simulateDelay(120)
    return computeReports()
  },
}
