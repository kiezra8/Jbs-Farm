import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useAuthStore = create(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      user: null,
      pin: '1234', // default PIN

      login: (enteredPin) => {
        if (enteredPin === get().pin) {
          set({ isAuthenticated: true, user: { name: 'Farm Owner', role: 'admin' } })
          return true
        }
        return false
      },
      logout: () => set({ isAuthenticated: false, user: null }),
      changePin: (oldPin, newPin) => {
        if (oldPin === get().pin) {
          set({ pin: newPin })
          return true
        }
        return false
      },
    }),
    { name: 'jbs-auth-store' }
  )
)
