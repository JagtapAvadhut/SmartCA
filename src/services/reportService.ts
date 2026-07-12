import { simulateDelay } from './api'
import { computeReports } from './analyticsService'
import type { ReportData } from '@/types'

export const ReportService = {
  async getData(): Promise<ReportData> {
    await simulateDelay(120)
    return computeReports()
  },
}
