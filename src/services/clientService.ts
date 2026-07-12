import { createCrudService } from './crudFactory'
import { COLLECTION, getCollection } from '@/db'
import { simulateDelay } from './api'
import type { Client } from '@/types'

const base = createCrudService<Client>(COLLECTION.clients, {
  searchFields: ['name', 'email', 'pan', 'gstin', 'contactPerson', 'city'],
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
    await simulateDelay()
    const all = getCollection<Client>(COLLECTION.clients).find()
    return {
      total: all.length,
      active: all.filter((c) => c.status === 'active').length,
      inactive: all.filter((c) => c.status === 'inactive').length,
      prospect: all.filter((c) => c.status === 'prospect').length,
    }
  },
}
