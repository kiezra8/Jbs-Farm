import { create } from 'zustand'
import { db } from '../db/schema'
import { getFirestoreDb } from '../services/syncEngine'
import { doc, deleteDoc } from 'firebase/firestore'

export const useAnimalStore = create((set, get) => ({
  animals: [],
  loading: false,
  selectedAnimal: null,
  searchQuery: '',
  filters: { breed: '', gender: '', status: '' },

  loadAnimals: async () => {
    set({ loading: true })
    const animals = await db.animals.orderBy('tagNumber').toArray()
    set({ animals, loading: false })
  },

  addAnimal: async (data) => {
    const now = new Date().toISOString()
    const id = crypto.randomUUID()
    await db.animals.add({ ...data, id, createdAt: now, updatedAt: now })
    const animal = await db.animals.get(id)
    set(s => ({ animals: [...s.animals, animal] }))
    return animal
  },

  updateAnimal: async (id, data) => {
    const now = new Date().toISOString()
    await db.animals.update(id, { ...data, updatedAt: now })
    const animal = await db.animals.get(id)
    set(s => ({ animals: s.animals.map(a => a.id === id ? animal : a) }))
    return animal
  },

  deleteAnimal: async (id) => {
    // 1. Delete animal and associated health/breeding records, PRESERVING milk records
    await db.animals.delete(id)
    await db.healthRecords.where('animalId').equals(id).delete()
    await db.breedingRecords.where('animalId').equals(id).delete()
    // NOTE: db.milkRecords is intentionally kept so milk records are NEVER lost

    // 2. Permanently delete from Firebase Firestore so it never comes back
    try {
      const firestore = getFirestoreDb()
      if (firestore) {
        await deleteDoc(doc(firestore, 'animals', String(id)))
      }
    } catch (e) {
      console.warn('Firestore direct delete warning:', e)
    }

    set(s => ({ animals: s.animals.filter(a => a.id !== id) }))
  },

  setSelectedAnimal: (animal) => set({ selectedAnimal: animal }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setFilter: (key, value) => set(s => ({ filters: { ...s.filters, [key]: value } })),
  resetFilters: () => set({ filters: { breed: '', gender: '', status: '' }, searchQuery: '' }),

  getFilteredAnimals: () => {
    const { animals, searchQuery, filters } = get()
    return animals.filter(a => {
      const q = searchQuery.toLowerCase()
      const matchSearch = !q || 
        a.name?.toLowerCase().includes(q) || 
        a.tagNumber?.toLowerCase().includes(q) || 
        a.breed?.toLowerCase().includes(q) ||
        (typeof a.age === 'string' && a.age.toLowerCase().includes(q)) ||
        (Boolean(a.hasCalf) && ('with calf'.includes(q) || 'calf'.includes(q)))
      const matchBreed = !filters.breed || a.breed === filters.breed
      const matchGender = !filters.gender || a.gender === filters.gender
      
      const hasStatus = (val, st) => {
        if (!st) return true
        if (Array.isArray(val)) return val.includes(st)
        if (typeof val === 'string') return val.split(',').map(s => s.trim()).includes(st)
        return val === st
      }
      const matchStatus = !filters.status || hasStatus(a.status, filters.status)

      return matchSearch && matchBreed && matchGender && matchStatus
    })
  },

  getStats: () => {
    const { animals } = get()
    const hasStatus = (a, st) => {
      if (Array.isArray(a.status)) return a.status.includes(st)
      if (typeof a.status === 'string') return a.status.split(',').map(s => s.trim()).includes(st)
      return a.status === st
    }

    return {
      total: animals.length,
      cows: animals.filter(a => a.gender === 'Female').length,
      bulls: animals.filter(a => a.gender === 'Male').length,
      sick: animals.filter(a => hasStatus(a, 'Sick')).length,
      pregnant: animals.filter(a => hasStatus(a, 'Pregnant')).length,
      healthy: animals.filter(a => hasStatus(a, 'Healthy')).length,
    }
  },
}))
