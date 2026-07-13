import { createCrudService } from './crudFactory'
import type { QueryParams } from './httpClient'
import type { ComplianceRecord, GSTFiling, ITRFiling, TDSRecord, ROCFiling } from '@/types'

const complianceBase = createCrudService<ComplianceRecord>('compliance', {
  beforeCreate: (data) => ({
    priority: 'medium',
    status: 'upcoming',
    description: data.description || data.service || '',
    tags: ['monthly'],
    dueDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
    ...data,
  }),
})

const gstBase = createCrudService<GSTFiling>('gst')
const itrBase = createCrudService<ITRFiling>('itr')
const tdsBase = createCrudService<TDSRecord>('tds')
const rocBase = createCrudService<ROCFiling>('roc')

export const ComplianceService = {
  ...complianceBase,
  async getKanban() {
    const all = await complianceBase.find()
    return {
      upcoming: all.filter((c) => c.status === 'upcoming'),
      in_progress: all.filter((c) => c.status === 'in_progress'),
      waiting_client: all.filter((c) => c.status === 'waiting_client'),
      completed: all.filter((c) => c.status === 'completed'),
    }
  },
  async updateStatus(id: string, status: ComplianceRecord['status']) {
    return complianceBase.update(id, { status })
  },
  async getGST(params?: QueryParams) {
    return gstBase.getAll(params)
  },
  async createGST(data: Partial<GSTFiling>) {
    return gstBase.create(data)
  },
  async updateGST(id: string, data: Partial<GSTFiling>) {
    return gstBase.update(id, data)
  },
  async deleteGST(id: string) {
    return gstBase.delete(id)
  },
  async getITR(params?: QueryParams) {
    return itrBase.getAll(params)
  },
  async createITR(data: Partial<ITRFiling>) {
    return itrBase.create(data)
  },
  async updateITR(id: string, data: Partial<ITRFiling>) {
    return itrBase.update(id, data)
  },
  async deleteITR(id: string) {
    return itrBase.delete(id)
  },
  async getTDS(params?: QueryParams) {
    return tdsBase.getAll(params)
  },
  async createTDS(data: Partial<TDSRecord>) {
    return tdsBase.create(data)
  },
  async updateTDS(id: string, data: Partial<TDSRecord>) {
    return tdsBase.update(id, data)
  },
  async deleteTDS(id: string) {
    return tdsBase.delete(id)
  },
  async getROC(params?: QueryParams) {
    return rocBase.getAll(params)
  },
  async createROC(data: Partial<ROCFiling>) {
    return rocBase.create(data)
  },
  async updateROC(id: string, data: Partial<ROCFiling>) {
    return rocBase.update(id, data)
  },
  async deleteROC(id: string) {
    return rocBase.delete(id)
  },
}
