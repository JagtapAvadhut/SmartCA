import { createCrudService } from './crudFactory'
import type { Task } from '@/types'

const base = createCrudService<Task>('tasks', {
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
    const all = await base.find()
    return all.filter((t) => t.status !== 'completed').slice(0, 10)
  },
}
