import { COLLECTION, getCollection } from '@/db'
import { simulateDelay } from './api'
import { createCrudService } from './crudFactory'

export interface NoteRecord {
  id: string
  title: string
  body: string
  clientId?: string
  clientName?: string
  pinned?: boolean
  createdAt?: string
  updatedAt?: string
  archived?: boolean
}

const base = createCrudService<NoteRecord>(COLLECTION.notes, {
  searchFields: ['title', 'body', 'clientName'],
  beforeCreate: (data) => ({
    title: 'Untitled note',
    body: '',
    pinned: false,
    ...data,
  }),
})

export const NoteService = {
  ...base,
  async getPinned() {
    await simulateDelay()
    return getCollection<NoteRecord>(COLLECTION.notes).find({ filter: { pinned: true } })
  },
}
