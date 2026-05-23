import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useUIStore = create(
  persist(
    (set, get) => ({
      darkMode: true,
      sidebarCollapsed: false,
      mobileMenuOpen: false,
      activeModal: null,
      
      toggleDarkMode: () => {
        const next = !get().darkMode
        set({ darkMode: next })
        if (next) {
          document.documentElement.classList.add('dark')
          document.documentElement.classList.remove('light')
        } else {
          document.documentElement.classList.remove('dark')
          document.documentElement.classList.add('light')
        }
      },
      initTheme: () => {
        const dark = get().darkMode
        if (dark) {
          document.documentElement.classList.add('dark')
          document.documentElement.classList.remove('light')
        } else {
          document.documentElement.classList.remove('dark')
          document.documentElement.classList.add('light')
        }
      },
      toggleSidebar: () => set(s => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setMobileMenu: (v) => set({ mobileMenuOpen: v }),
      openModal: (name) => set({ activeModal: name }),
      closeModal: () => set({ activeModal: null }),
    }),
    { name: 'jbs-ui-store' }
  )
)
