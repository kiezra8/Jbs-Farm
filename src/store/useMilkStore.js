import { create } from 'zustand'
import { db } from '../db/schema'
import { format, subDays } from 'date-fns'

export const useMilkStore = create((set, get) => ({
  records: [],
  loading: false,

  loadRecords: async () => {
    set({ loading: true })
    const records = await db.milkRecords.orderBy('date').reverse().toArray()
    set({ records, loading: false })
  },

  addRecord: async (data) => {
    const now = new Date().toISOString()
    const id = await db.milkRecords.add({ ...data, createdAt: now })
    const record = await db.milkRecords.get(id)
    set(s => ({ records: [record, ...s.records] }))
    return record
  },

  deleteRecord: async (id) => {
    await db.milkRecords.delete(id)
    set(s => ({ records: s.records.filter(r => r.id !== id) }))
  },

  getTodayTotal: () => {
    const today = format(new Date(), 'yyyy-MM-dd')
    return get().records
      .filter(r => r.date === today)
      .reduce((sum, r) => sum + (r.amount || 0), 0)
  },

  getDailyTotals: (days = 30) => {
    const { records } = get()
    const result = []
    for (let i = days - 1; i >= 0; i--) {
      const date = format(subDays(new Date(), i), 'yyyy-MM-dd')
      const total = records.filter(r => r.date === date).reduce((sum, r) => sum + (r.amount || 0), 0)
      result.push({ date, total, label: format(subDays(new Date(), i), 'MMM d') })
    }
    return result
  },

  getPerCowProduction: (animalId) => {
    return get().records.filter(r => r.animalId === animalId).reduce((sum, r) => sum + (r.amount || 0), 0)
  },

  getStats: () => {
    const { records } = get()
    const today = format(new Date(), 'yyyy-MM-dd')
    const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd')
    const todayTotal = records.filter(r => r.date === today).reduce((sum, r) => sum + (r.amount || 0), 0)
    const yesterdayTotal = records.filter(r => r.date === yesterday).reduce((sum, r) => sum + (r.amount || 0), 0)
    const change = yesterdayTotal > 0 ? ((todayTotal - yesterdayTotal) / yesterdayTotal * 100).toFixed(1) : 0
    const monthTotal = records.reduce((sum, r) => sum + (r.amount || 0), 0)
    return { todayTotal, yesterdayTotal, change: Number(change), monthTotal }
  },
}))
