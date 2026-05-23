import { create } from 'zustand'

export const useSyncStore = create((set, get) => ({
  isOnline: navigator.onLine,
  isSyncing: false,
  lastSynced: null,
  queueCount: 0,
  syncError: null,

  setOnline: (v) => set({ isOnline: v }),
  setSyncing: (v) => set({ isSyncing: v }),
  setLastSynced: (t) => set({ lastSynced: t }),
  setQueueCount: (n) => set({ queueCount: n }),
  setSyncError: (e) => set({ syncError: e }),
  incrementQueue: () => set(s => ({ queueCount: s.queueCount + 1 })),
  decrementQueue: () => set(s => ({ queueCount: Math.max(0, s.queueCount - 1) })),
}))
