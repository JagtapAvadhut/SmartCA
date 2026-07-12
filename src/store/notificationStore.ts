import { create } from 'zustand'
import { COLLECTION, getCollection } from '@/db'
import type { Notification } from '@/types'

function loadNotifications(): Notification[] {
  try {
    return getCollection<Notification>(COLLECTION.notifications).find() as Notification[]
  } catch {
    return []
  }
}

interface NotificationState {
  notifications: Notification[]
  unreadCount: number
  initialize: () => void
  refresh: () => void
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  archive: (id: string) => void
  deleteNotification: (id: string) => void
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt'>) => void
}

export const useNotificationStore = create<NotificationState>()((set) => ({
  notifications: [],
  unreadCount: 0,

  initialize: () => {
    const data = loadNotifications()
    set({ notifications: data, unreadCount: data.filter((n) => !n.read).length })
  },

  refresh: () => {
    const data = loadNotifications()
    set({ notifications: data, unreadCount: data.filter((n) => !n.read).length })
  },

  markAsRead: (id) => {
    getCollection(COLLECTION.notifications).update(id, { read: true })
    const data = loadNotifications()
    set({ notifications: data, unreadCount: data.filter((n) => !n.read).length })
  },

  markAllAsRead: () => {
    const col = getCollection(COLLECTION.notifications)
    col.find({ filter: { read: false } }).forEach((n) => col.update(n.id, { read: true }))
    const data = loadNotifications()
    set({ notifications: data, unreadCount: 0 })
  },

  archive: (id) => {
    getCollection(COLLECTION.notifications).archive(id)
    const data = loadNotifications()
    set({ notifications: data, unreadCount: data.filter((n) => !n.read).length })
  },

  deleteNotification: (id) => {
    getCollection(COLLECTION.notifications).delete(id)
    const data = loadNotifications()
    set({ notifications: data, unreadCount: data.filter((n) => !n.read).length })
  },

  addNotification: (notification) => {
    getCollection(COLLECTION.notifications).insert({
      ...notification,
      createdAt: new Date().toISOString(),
      read: false,
    })
    const data = loadNotifications()
    set({ notifications: data, unreadCount: data.filter((n) => !n.read).length })
  },
}))
