import { createCrudService } from './crudFactory'
import { roundMoney } from '@/utils/money'
import type { Payment } from '@/types'

const base = createCrudService<Payment>('payments', {
  beforeCreate: (data) => ({
    paymentDate: new Date().toISOString().split('T')[0],
    method: 'bank_transfer',
    status: 'completed',
    notes: '',
    reference: `TXN${Date.now()}`,
    recordedBy: '',
    ...data,
    amount: roundMoney(Number(data.amount || 0)),
  }),
})

export const PaymentService = {
  ...base,
  async create(data: Partial<Payment>) {
    return base.create({
      ...data,
      amount: data.amount != null ? roundMoney(Number(data.amount)) : data.amount,
    })
  },
  async update(id: string, data: Partial<Payment>) {
    return base.update(id, {
      ...data,
      amount: data.amount != null ? roundMoney(Number(data.amount)) : undefined,
    })
  },
  async delete(id: string) {
    return base.delete(id)
  },
  async getByClient(clientId: string) {
    return base.find({ clientId })
  },
  async getStats() {
    const all = await base.find()
    return {
      total: all.length,
      completed: all.filter((p) => p.status === 'completed').length,
      totalAmount: all.filter((p) => p.status === 'completed').reduce((s, p) => s + p.amount, 0),
    }
  },
}
