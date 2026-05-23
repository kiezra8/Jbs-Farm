import { create } from 'zustand'
import { db } from '../db/schema'

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
    const id = await db.animals.add({ ...data, createdAt: now, updatedAt: now })
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
    await db.animals.delete(id)
    await db.healthRecords.where('animalId').equals(id).delete()
    await db.breedingRecords.where('animalId').equals(id).delete()
    await db.milkRecords.where('animalId').equals(id).delete()
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
      const matchSearch = !q || a.name?.toLowerCase().includes(q) || a.tagNumber?.toLowerCase().includes(q) || a.breed?.toLowerCase().includes(q)
      const matchBreed = !filters.breed || a.breed === filters.breed
      const matchGender = !filters.gender || a.gender === filters.gender
      const matchStatus = !filters.status || a.status === filters.status
      return matchSearch && matchBreed && matchGender && matchStatus
    })
  },

  getStats: () => {
    const { animals } = get()
    return {
      total: animals.length,
      cows: animals.filter(a => a.gender === 'Female').length,
      bulls: animals.filter(a => a.gender === 'Male').length,
      calves: animals.filter(a => a.status === 'Calf').length,
      sick: animals.filter(a => a.status === 'Sick').length,
      pregnant: animals.filter(a => a.status === 'Pregnant').length,
      healthy: animals.filter(a => a.status === 'Healthy').length,
    }
  },
}))
