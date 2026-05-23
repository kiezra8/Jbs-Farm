import { create } from 'zustand'
import { db } from '../db/schema'

export const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,

  loadNotifications: async () => {
    const items = await db.notifications.orderBy('createdAt').reverse().limit(100).toArray()
    const unread = items.filter(n => !n.read).length
    set({ notifications: items, unreadCount: unread })
  },

  addNotification: async (notif) => {
    const id = await db.notifications.add({
      ...notif,
      read: false,
      createdAt: new Date().toISOString(),
    })
    const item = await db.notifications.get(id)
    set(s => ({
      notifications: [item, ...s.notifications],
      unreadCount: s.unreadCount + 1,
    }))
  },

  markRead: async (id) => {
    await db.notifications.update(id, { read: true })
    set(s => ({
      notifications: s.notifications.map(n => n.id === id ? { ...n, read: true } : n),
      unreadCount: Math.max(0, s.unreadCount - 1),
    }))
  },

  markAllRead: async () => {
    await db.notifications.toCollection().modify({ read: true })
    set(s => ({
      notifications: s.notifications.map(n => ({ ...n, read: true })),
      unreadCount: 0,
    }))
  },

  clearAll: async () => {
    await db.notifications.clear()
    set({ notifications: [], unreadCount: 0 })
  },
}))
