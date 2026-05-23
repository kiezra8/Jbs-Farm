import { useLocation, useNavigate } from 'react-router-dom'
import { Bell, Sun, Moon, Menu, Search, Wifi, WifiOff, RefreshCw } from 'lucide-react'
import { useUIStore } from '../../store/useUIStore'
import { useSyncStore } from '../../store/useSyncStore'
import { useNotificationStore } from '../../store/useNotificationStore'
import { format } from 'date-fns'

const pageTitles = {
  '/dashboard': 'Dashboard',
  '/animals': 'Animal Management',
  '/health': 'Health Management',
  '/breeding': 'Breeding Management',
  '/milk': 'Milk Production',
  '/feed': 'Feed & Nutrition',
  '/finance': 'Financial Management',
  '/staff': 'Staff Management',
  '/analytics': 'Analytics & Intelligence',
  '/reports': 'Reports',
  '/notifications': 'Notifications',
  '/settings': 'Settings',
}

export default function Topbar() {
  const { darkMode, toggleDarkMode, toggleSidebar, setMobileMenu, mobileMenuOpen } = useUIStore()
  const { isOnline, isSyncing, lastSynced, queueCount } = useSyncStore()
  const { unreadCount } = useNotificationStore()
  const location = useLocation()
  const navigate = useNavigate()

  const title = pageTitles[location.pathname] || 'JBS Farm'
  const lastSyncText = lastSynced ? `Synced ${format(new Date(lastSynced), 'HH:mm')}` : 'Not synced'

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between px-4 md:px-6 py-3 border-b"
      style={{
        background: 'rgba(2,6,23,0.85)',
        borderColor: 'rgba(255,255,255,0.06)',
        backdropFilter: 'blur(20px)',
      }}
    >
      {/* Left */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setMobileMenu(!mobileMenuOpen)}
          className="md:hidden p-2 rounded-lg hover:bg-white/10 transition-colors text-slate-400"
        >
          <Menu size={18} />
        </button>
        <div>
          <h1 className="font-display font-bold text-base text-white leading-none">{title}</h1>
          <p className="text-xs text-slate-500 mt-0.5">{format(new Date(), 'EEEE, d MMMM yyyy')}</p>
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        {/* Sync Status */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
          {isSyncing ? (
            <RefreshCw size={13} className="animate-spin text-amber-400" />
          ) : isOnline ? (
            <Wifi size={13} className="text-green-400" />
          ) : (
            <WifiOff size={13} className="text-red-400" />
          )}
          <span className={isSyncing ? 'text-amber-400' : isOnline ? 'text-green-400' : 'text-red-400'}>
            {isSyncing ? 'Syncing...' : isOnline ? lastSyncText : 'Offline'}
          </span>
          {queueCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px]">
              {queueCount} pending
            </span>
          )}
        </div>

        {/* Dark mode */}
        <button onClick={toggleDarkMode}
          className="p-2 rounded-xl hover:bg-white/10 transition-colors text-slate-400 hover:text-white">
          {darkMode ? <Sun size={17} /> : <Moon size={17} />}
        </button>

        {/* Notifications */}
        <button onClick={() => navigate('/notifications')}
          className="relative p-2 rounded-xl hover:bg-white/10 transition-colors text-slate-400 hover:text-white">
          <Bell size={17} />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center font-bold">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </div>
    </header>
  )
}
