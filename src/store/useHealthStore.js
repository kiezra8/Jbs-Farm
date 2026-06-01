import { create } from 'zustand'
import { db } from '../db/schema'

export const useHealthStore = create((set, get) => ({
  records: [],
  loading: false,

  loadRecords: async () => {
    set({ loading: true })
    const records = await db.healthRecords.orderBy('date').reverse().toArray()
    set({ records, loading: false })
  },

  addRecord: async (data) => {
    const now = new Date().toISOString()
    const id = crypto.randomUUID()
    await db.healthRecords.add({ ...data, id, createdAt: now, updatedAt: now })
    const record = await db.healthRecords.get(id)
    set(s => ({ records: [record, ...s.records] }))
    return record
  },

  updateRecord: async (id, data) => {
    await db.healthRecords.update(id, { ...data, updatedAt: new Date().toISOString() })
    const record = await db.healthRecords.get(id)
    set(s => ({ records: s.records.map(r => r.id === id ? record : r) }))
  },

  deleteRecord: async (id) => {
    await db.healthRecords.delete(id)
    set(s => ({ records: s.records.filter(r => r.id !== id) }))
  },

  getByAnimal: (animalId) => get().records.filter(r => r.animalId === animalId),

  getUpcomingVaccinations: () => {
    const now = new Date()
    const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    return get().records.filter(r => r.type === 'Vaccination' && r.nextDue && new Date(r.nextDue) <= in30)
  },

  getStats: () => {
    const { records } = get()
    return {
      total: records.length,
      vaccinations: records.filter(r => r.type === 'Vaccination').length,
      treatments: records.filter(r => r.type === 'Treatment').length,
      deworming: records.filter(r => r.type === 'Deworming').length,
      vetVisits: records.filter(r => r.type === 'Vet Visit').length,
      mortality: records.filter(r => r.type === 'Mortality').length,
    }
  },
}))
