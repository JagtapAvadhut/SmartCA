import { http } from './httpClient'
import type { ReportData } from '@/types'

export const ReportService = {
  async getData(): Promise<ReportData> {
    return http.get<ReportData>('/reports/summary')
  },
}
