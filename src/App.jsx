import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from './store/useAuthStore'
import { useUIStore } from './store/useUIStore'
import { initSyncEngine, initSupabase, fetchAllFromSupabase } from './services/syncEngine'

import AppLayout from './components/layout/AppLayout'

// Pages
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Animals from './pages/Animals'
import Health from './pages/Health'
import Breeding from './pages/Breeding'
import Milk from './pages/Milk'
import Feed from './pages/Feed'
import Finance from './pages/Finance'
import Staff from './pages/Staff'
import Analytics from './pages/Analytics'
import Reports from './pages/Reports'
import Notifications from './pages/Notifications'
import Settings from './pages/Settings'

// Protected Route Wrapper
const ProtectedRoute = () => {
  const { isAuthenticated } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  )
}

function App() {
  const { initTheme } = useUIStore()

  useEffect(() => {
    initTheme()

    // Supabase credentials come from Cloudflare env vars (set in Pages dashboard)
    // They are NEVER stored in source code or the settings page
    const url = import.meta.env.VITE_SUPABASE_URL
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY

    if (url && key) {
      const ok = initSupabase(url, key)
      if (ok && navigator.onLine) {
        // Pull latest cloud data so all users see the same records
        fetchAllFromSupabase()
      }
    }

    // Start the offline sync engine (queues writes, flushes on reconnect)
    const cleanupSync = initSyncEngine()
    return () => cleanupSync()
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/animals" element={<Animals />} />
          <Route path="/health" element={<Health />} />
          <Route path="/breeding" element={<Breeding />} />
          <Route path="/milk" element={<Milk />} />
          <Route path="/feed" element={<Feed />} />
          <Route path="/finance" element={<Finance />} />
          <Route path="/staff" element={<Staff />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
