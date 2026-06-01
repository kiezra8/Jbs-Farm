import { create } from 'zustand'
import { db } from '../db/schema'

export const useStaffStore = create((set, get) => ({
  staff: [],
  attendance: [],
  tasks: [],
  loading: false,

  loadAll: async () => {
    set({ loading: true })
    const staff = await db.staff.toArray()
    const attendance = await db.attendance.orderBy('date').reverse().toArray()
    const tasks = await db.tasks.orderBy('createdAt').reverse().toArray()
    set({ staff, attendance, tasks, loading: false })
  },

  addStaff: async (data) => {
    const now = new Date().toISOString()
    const id = await db.staff.add({ ...data, createdAt: now })
    const member = await db.staff.get(id)
    set(s => ({ staff: [...s.staff, member] }))
    return member
  },

  updateStaff: async (id, data) => {
    await db.staff.update(id, { ...data, updatedAt: new Date().toISOString() })
    const member = await db.staff.get(id)
    set(s => ({ staff: s.staff.map(m => m.id === id ? member : m) }))
  },

  deleteStaff: async (id) => {
    await db.staff.delete(id)
    set(s => ({ staff: s.staff.filter(m => m.id !== id) }))
  },

  markAttendance: async (data) => {
    const id = await db.attendance.add({ ...data, createdAt: new Date().toISOString() })
    const record = await db.attendance.get(id)
    set(s => ({ attendance: [record, ...s.attendance] }))
    return record
  },

  addTask: async (data) => {
    const now = new Date().toISOString()
    const id = await db.tasks.add({ ...data, status: 'Pending', createdAt: now })
    const task = await db.tasks.get(id)
    set(s => ({ tasks: [task, ...s.tasks] }))
    return task
  },

  updateTask: async (id, data) => {
    await db.tasks.update(id, { ...data, updatedAt: new Date().toISOString() })
    const task = await db.tasks.get(id)
    set(s => ({ tasks: s.tasks.map(t => t.id === id ? task : t) }))
  },

  deleteTask: async (id) => {
    await db.tasks.delete(id)
    set(s => ({ tasks: s.tasks.filter(t => t.id !== id) }))
  },

  getStats: () => {
    const { staff, attendance, tasks } = get()
    const today = new Date().toISOString().split('T')[0]
    const todayAttendance = attendance.filter(a => a.date === today)
    return {
      total: staff.length,
      present: todayAttendance.filter(a => a.status === 'Present').length,
      absent: todayAttendance.filter(a => a.status === 'Absent').length,
      pendingTasks: tasks.filter(t => t.status === 'Pending').length,
      completedTasks: tasks.filter(t => t.status === 'Completed').length,
    }
  },
}))
