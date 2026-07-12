import { createCrudService } from './crudFactory'
import { COLLECTION, getCollection } from '@/db'
import { simulateDelay } from './api'
import type { Company, Notification, ChatSession, CalendarEvent, Activity } from '@/types'

const companyBase = createCrudService<Company>(COLLECTION.companies, {
  searchFields: ['name', 'cin', 'industry', 'gstin'],
  beforeCreate: (data) => ({
    incorporationDate: new Date().toISOString().split('T')[0],
    registeredAddress: '',
    authorizedCapital: 100000,
    paidUpCapital: 100000,
    directors: [],
    status: 'active',
    financialYearEnd: '31-03',
    industry: 'IT',
    employees: 10,
    turnover: 1000000,
    ...data,
  }),
})

export const CompanyService = {
  ...companyBase,
  async getByClient(clientId: string) {
    await simulateDelay()
    return getCollection<Company>(COLLECTION.companies).find({ filter: { clientId } })
  },
}

export const NotificationService = {
  async getAll() {
    await simulateDelay()
    return getCollection<Notification>(COLLECTION.notifications).find()
  },
  async getUnread() {
    await simulateDelay()
    return getCollection<Notification>(COLLECTION.notifications).find({ filter: { read: false } })
  },
  async markRead(id: string) {
    await simulateDelay(100)
    return getCollection<Notification>(COLLECTION.notifications).update(id, { read: true })
  },
  async markAllRead() {
    await simulateDelay(100)
    const col = getCollection<Notification>(COLLECTION.notifications)
    col.find({ filter: { read: false } }).forEach((n) => col.update(n.id, { read: true }))
    return { success: true }
  },
  async delete(id: string) {
    await simulateDelay(100)
    getCollection<Notification>(COLLECTION.notifications).delete(id)
    return { success: true }
  },
  async create(data: Partial<Notification>) {
    return getCollection<Notification>(COLLECTION.notifications).insert({
      title: 'Notification',
      message: '',
      type: 'info',
      read: false,
      link: '/',
      createdAt: new Date().toISOString(),
      ...data,
    } as Omit<Notification, 'id'> & { id?: string })
  },
}

export const ChatService = {
  async getSessions() {
    await simulateDelay()
    return getCollection<ChatSession>(COLLECTION.chat).find()
  },
  async getSession(id: string) {
    await simulateDelay()
    const session = getCollection<ChatSession>(COLLECTION.chat).findById(id)
    if (!session) throw new Error('Chat session not found')
    return session
  },
  async createSession(title: string) {
    await simulateDelay(200)
    return getCollection<ChatSession>(COLLECTION.chat).insert({
      title,
      createdAt: new Date().toISOString().split('T')[0],
      messages: [],
    } as Omit<ChatSession, 'id'> & { id?: string })
  },
  async sendMessage(sessionId: string, content: string) {
    await simulateDelay(800)
    const col = getCollection<ChatSession>(COLLECTION.chat)
    const session = col.findById(sessionId)
    if (!session) throw new Error('Chat session not found')
    const userMsg = { id: String(Date.now()), role: 'user' as const, content, timestamp: new Date().toISOString() }
    const assistantMsg = {
      id: String(Date.now() + 1),
      role: 'assistant' as const,
      content:
        'Thank you for your query. As your AI CA assistant, I can help with GST filing, ITR computations, TDS rates, ROC compliance, and tax planning. Please share more details about your requirement.',
      timestamp: new Date().toISOString(),
    }
    const messages = [...(session.messages || []), userMsg, assistantMsg]
    col.update(sessionId, { messages })
    return { userMsg, assistantMsg }
  },
  async deleteSession(id: string) {
    await simulateDelay(200)
    getCollection<ChatSession>(COLLECTION.chat).delete(id)
    return { success: true }
  },
}

export const CalendarService = {
  async getAll() {
    await simulateDelay()
    return getCollection<CalendarEvent>(COLLECTION.calendar).find({ sortBy: 'date', sortOrder: 'asc', pageSize: 100000 })
  },
  async getEvents() {
    return this.getAll()
  },
  async create(data: Partial<CalendarEvent>) {
    await simulateDelay(200)
    return getCollection<CalendarEvent>(COLLECTION.calendar).insert({
      date: new Date().toISOString().split('T')[0],
      time: '10:00',
      duration: 60,
      type: 'meeting',
      color: '#6366f1',
      clientId: null,
      clientName: null,
      assignedTo: '',
      ...data,
    } as Omit<CalendarEvent, 'id'> & { id?: string })
  },
  async update(id: string, data: Partial<CalendarEvent>) {
    await simulateDelay(200)
    return getCollection<CalendarEvent>(COLLECTION.calendar).update(id, data)
  },
  async delete(id: string) {
    await simulateDelay(200)
    getCollection<CalendarEvent>(COLLECTION.calendar).delete(id)
    return { success: true }
  },
}

export const ActivityService = {
  async getAll() {
    await simulateDelay()
    return getCollection<Activity>(COLLECTION.activities).find()
  },
  async log(message: string, type: string, clientId = '', clientName = '', userId = '', userName = '') {
    return getCollection<Activity>(COLLECTION.activities).insert({
      type,
      message,
      clientId,
      clientName,
      userId,
      userName,
      timestamp: new Date().toISOString(),
    } as Omit<Activity, 'id'> & { id?: string })
  },
}
