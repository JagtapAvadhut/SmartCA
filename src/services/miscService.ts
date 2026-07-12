import { createCrudService } from './crudFactory'
import { http, type PaginatedResult } from './httpClient'
import type { Company, Notification, ChatSession, CalendarEvent, Activity } from '@/types'

const companyBase = createCrudService<Company>('companies', {
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
    return companyBase.find({ clientId })
  },
}

export const NotificationService = {
  async getAll() {
    const res = await http.get<PaginatedResult<Notification>>('/notifications', {
      params: { page: 1, pageSize: 100000 },
    })
    return res.data
  },
  async getUnread() {
    const all = await this.getAll()
    return all.filter((n) => !n.read)
  },
  async markRead(id: string) {
    return http.patch<Notification>(`/notifications/${id}`, { read: true })
  },
  async markAllRead() {
    const unread = await this.getUnread()
    await Promise.all(unread.map((n) => this.markRead(n.id)))
    return { success: true }
  },
  async delete(id: string) {
    await http.del(`/notifications/${id}`)
    return { success: true }
  },
  async create(data: Partial<Notification>) {
    return http.post<Notification>('/notifications', {
      title: 'Notification',
      message: '',
      type: 'info',
      read: false,
      link: '/',
      createdAt: new Date().toISOString(),
      ...data,
    })
  },
  async archive(id: string) {
    await http.post(`/notifications/${id}/archive`)
    return { success: true }
  },
}

export const ChatService = {
  async getSessions() {
    const res = await http.get<PaginatedResult<ChatSession>>('/chat', {
      params: { page: 1, pageSize: 100000 },
    })
    return res.data
  },
  async getSession(id: string) {
    return http.get<ChatSession>(`/chat/${id}`)
  },
  async createSession(title: string) {
    return http.post<ChatSession>('/chat', {
      title,
      createdAt: new Date().toISOString().split('T')[0],
      messages: [],
    })
  },
  async sendMessage(sessionId: string, content: string) {
    const session = await this.getSession(sessionId)
    const userMsg = {
      id: String(Date.now()),
      role: 'user' as const,
      content,
      timestamp: new Date().toISOString(),
    }
    const assistantMsg = {
      id: String(Date.now() + 1),
      role: 'assistant' as const,
      content:
        'Thank you for your query. As your AI CA assistant, I can help with GST filing, ITR computations, TDS rates, ROC compliance, and tax planning. Please share more details about your requirement.',
      timestamp: new Date().toISOString(),
    }
    const messages = [...(session.messages || []), userMsg, assistantMsg]
    await http.patch(`/chat/${sessionId}`, { messages })
    return { userMsg, assistantMsg }
  },
  async deleteSession(id: string) {
    await http.del(`/chat/${id}`)
    return { success: true }
  },
}

export const CalendarService = {
  async getAll() {
    const res = await http.get<PaginatedResult<CalendarEvent>>('/calendar-events', {
      params: { page: 1, pageSize: 100000, sortBy: 'date', sortOrder: 'asc' },
    })
    return res.data
  },
  async getEvents() {
    return this.getAll()
  },
  async create(data: Partial<CalendarEvent>) {
    return http.post<CalendarEvent>('/calendar-events', {
      date: new Date().toISOString().split('T')[0],
      time: '10:00',
      duration: 60,
      type: 'meeting',
      color: '#6366f1',
      clientId: null,
      clientName: null,
      assignedTo: '',
      ...data,
    })
  },
  async update(id: string, data: Partial<CalendarEvent>) {
    return http.patch<CalendarEvent>(`/calendar-events/${id}`, data)
  },
  async delete(id: string) {
    await http.del(`/calendar-events/${id}`)
    return { success: true }
  },
}

export const ActivityService = {
  async getAll() {
    const res = await http.get<PaginatedResult<Activity>>('/activities', {
      params: { page: 1, pageSize: 100000 },
    })
    return res.data
  },
  async log(message: string, type: string, clientId = '', clientName = '', userId = '', userName = '') {
    return http.post<Activity>('/activities', {
      type,
      message,
      clientId,
      clientName,
      userId,
      userName,
      timestamp: new Date().toISOString(),
    })
  },
}
