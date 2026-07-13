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

const base = createCrudService<NoteRecord>('notes', {
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
    const all = await base.find()
    return all.filter((n) => n.pinned)
  },
}
