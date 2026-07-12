import { createCrudService } from './crudFactory'
import { COLLECTION, getCollection } from '@/db'
import { simulateDelay } from './api'
import type { Employee } from '@/types'

const base = createCrudService<Employee>(COLLECTION.employees, {
  searchFields: ['firstName', 'lastName', 'email', 'designation', 'department'],
  beforeCreate: (data) => {
    const firstName = data.firstName || 'New'
    const lastName = data.lastName || 'Employee'
    return {
      phone: '',
      designation: 'Associate',
      department: 'Tax',
      dateOfJoining: new Date().toISOString().split('T')[0],
      dateOfBirth: '1990-01-01',
      pan: '',
      status: 'active',
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${firstName}${lastName}`,
      address: '',
      salary: 300000,
      permissions: ['read'],
      role: 'staff',
      ...data,
      firstName,
      lastName,
    }
  },
})

export const EmployeeService = {
  ...base,
  async getBirthdays() {
    await simulateDelay()
    const now = new Date()
    return getCollection<Employee>(COLLECTION.employees)
      .find()
      .filter((e) => new Date(e.dateOfBirth).getMonth() === now.getMonth())
  },
}
