import { createCrudService } from './crudFactory'
import type { Client } from '@/types'

const base = createCrudService<Client>('clients', {
  beforeCreate: (data) => ({
    type: 'company',
    status: 'active',
    services: [],
    revenue: 0,
    outstanding: 0,
    tags: ['new'],
    notes: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    assignedTo: '',
    phone: '',
    ...data,
  }),
})

export const ClientService = {
  ...base,
  async getStats() {
    const all = await base.find()
    return {
      total: all.length,
      active: all.filter((c) => c.status === 'active').length,
      inactive: all.filter((c) => c.status === 'inactive').length,
      prospect: all.filter((c) => c.status === 'prospect').length,
    }
  },
}
