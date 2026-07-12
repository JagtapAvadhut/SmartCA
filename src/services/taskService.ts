import { createCrudService } from './crudFactory'
import { COLLECTION, getCollection } from '@/db'
import { simulateDelay } from './api'
import type { Task } from '@/types'

const base = createCrudService<Task>(COLLECTION.tasks, {
  searchFields: ['title', 'clientName', 'assignedToName', 'category'],
  beforeCreate: (data) => ({
    description: data.description || data.title || '',
    priority: 'medium',
    status: 'todo',
    category: 'compliance',
    completedAt: null,
    dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    ...data,
  }),
})

export const TaskService = {
  ...base,
  async getTodays() {
    await simulateDelay()
    return getCollection<Task>(COLLECTION.tasks)
      .find()
      .filter((t) => t.status !== 'completed')
      .slice(0, 10)
  },
}
