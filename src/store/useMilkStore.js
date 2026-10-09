import { create } from 'zustand'
import { db } from '../db/schema'
import { format, subDays } from 'date-fns'
import { getFirestoreDb } from '../services/syncEngine'
import { doc, setDoc, deleteDoc } from 'firebase/firestore'

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
    const id = crypto.randomUUID()
    const record = { ...data, id, createdAt: now, updatedAt: now }
    await db.milkRecords.add(record)
    // Fire-and-forget: Dexie hooks already queue this to Firebase
    try {
      const firestore = getFirestoreDb()
      if (firestore) {
        setDoc(doc(firestore, 'milkRecords', String(id)), record, { merge: true }).catch(() => {})
      }
    } catch (e) {}
    set(s => ({ records: [record, ...s.records] }))
    return record
  },

  updateRecord: async (id, data) => {
    const now = new Date().toISOString()
    await db.milkRecords.update(id, { ...data, updatedAt: now })
    const record = await db.milkRecords.get(id)
    // Fire-and-forget: Dexie hooks already queue this to Firebase
    try {
      const firestore = getFirestoreDb()
      if (firestore && record) {
        setDoc(doc(firestore, 'milkRecords', String(id)), record, { merge: true }).catch(() => {})
      }
    } catch (e) {}
    set(s => ({ records: s.records.map(r => r.id === id ? record : r) }))
    return record
  },

  deleteRecord: async (id) => {
    await db.milkRecords.delete(id)
    // Fire-and-forget: Dexie hooks already queue this to Firebase
    try {
      const firestore = getFirestoreDb()
      if (firestore) {
        deleteDoc(doc(firestore, 'milkRecords', String(id))).catch(() => {})
      }
    } catch (e) {}
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
      const dayRecords = records.filter(r => r.date === date)
      const total = dayRecords.reduce((sum, r) => sum + (r.amount || 0), 0)
      const calves = dayRecords.reduce((sum, r) => sum + (r.calvesAmount || 0), 0)
      const net = total - calves
      const revenue = net * 1500
      result.push({ date, total, calves, net, revenue, label: format(subDays(new Date(), i), 'MMM d') })
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
    
    const todayCalves = records.filter(r => r.date === today).reduce((sum, r) => sum + (r.calvesAmount || 0), 0)
    const todayNet = todayTotal - todayCalves
    const todayRevenue = todayNet * 1500

    const monthCalves = records.reduce((sum, r) => sum + (r.calvesAmount || 0), 0)
    const monthNet = monthTotal - monthCalves
    const monthRevenue = monthNet * 1500

    return { todayTotal, yesterdayTotal, change: Number(change), monthTotal, todayCalves, todayNet, todayRevenue, monthRevenue }
  },
}))
