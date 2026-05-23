import { create } from 'zustand'
import { db } from '../db/schema'

export const useBreedingStore = create((set, get) => ({
  records: [],
  loading: false,

  loadRecords: async () => {
    set({ loading: true })
    const records = await db.breedingRecords.orderBy('date').reverse().toArray()
    set({ records, loading: false })
  },

  addRecord: async (data) => {
    const now = new Date().toISOString()
    const id = await db.breedingRecords.add({ ...data, createdAt: now, updatedAt: now })
    const record = await db.breedingRecords.get(id)
    set(s => ({ records: [record, ...s.records] }))
    return record
  },

  updateRecord: async (id, data) => {
    await db.breedingRecords.update(id, { ...data, updatedAt: new Date().toISOString() })
    const record = await db.breedingRecords.get(id)
    set(s => ({ records: s.records.map(r => r.id === id ? record : r) }))
  },

  deleteRecord: async (id) => {
    await db.breedingRecords.delete(id)
    set(s => ({ records: s.records.filter(r => r.id !== id) }))
  },

  getByAnimal: (animalId) => get().records.filter(r => r.animalId === animalId),

  getPregnant: () => get().records.filter(r => r.status === 'Confirmed Pregnant'),

  getExpectedCalvings: () => {
    const now = new Date()
    const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    return get().records.filter(r => r.expectedCalving && new Date(r.expectedCalving) <= in30 && r.status === 'Confirmed Pregnant')
  },

  getStats: () => {
    const { records } = get()
    return {
      total: records.length,
      pregnant: records.filter(r => r.status === 'Confirmed Pregnant').length,
      ai: records.filter(r => r.type === 'AI').length,
      calved: records.filter(r => r.status === 'Calved').length,
      heatCycles: records.filter(r => r.type === 'Heat Cycle').length,
    }
  },
}))
