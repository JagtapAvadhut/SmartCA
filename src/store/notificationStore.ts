import { create } from 'zustand'
import { NotificationService } from '@/services/miscService'
import type { Notification } from '@/types'

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

function applyList(set: (partial: Partial<NotificationState>) => void, data: Notification[]) {
  set({ notifications: data, unreadCount: data.filter((n) => !n.read).length })
}

export const useNotificationStore = create<NotificationState>()((set, get) => ({
  notifications: [],
  unreadCount: 0,

  initialize: () => {
    void NotificationService.getAll()
      .then((data) => applyList(set, data))
      .catch(() => applyList(set, []))
  },

  refresh: () => {
    void NotificationService.getAll()
      .then((data) => applyList(set, data))
      .catch(() => applyList(set, []))
  },

  markAsRead: (id) => {
    void NotificationService.markRead(id).then(() => get().refresh())
  },

  markAllAsRead: () => {
    void NotificationService.markAllRead().then(() => get().refresh())
  },

  archive: (id) => {
    void NotificationService.archive(id).then(() => get().refresh())
  },

  deleteNotification: (id) => {
    void NotificationService.delete(id).then(() => get().refresh())
  },

  addNotification: (notification) => {
    void NotificationService.create(notification).then(() => get().refresh())
  },
}))
