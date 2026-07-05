import { NavLink, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Beef, Heart, Baby, Milk, Wheat, DollarSign,
  Users, BarChart3, FileText, Bell, Settings, LogOut, ChevronLeft,
  ChevronRight, Activity, Menu, X, Building2, PiggyBank
} from 'lucide-react'
import { useUIStore } from '../../store/useUIStore'
import { useAuthStore } from '../../store/useAuthStore'
import { useSyncStore } from '../../store/useSyncStore'
import { useNotificationStore } from '../../store/useNotificationStore'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/animals', icon: Beef, label: 'Animals' },
  { to: '/health', icon: Heart, label: 'Health' },
  { to: '/breeding', icon: Baby, label: 'Breeding' },
  { to: '/milk', icon: Milk, label: 'Milk Production' },
  { to: '/feed', icon: Wheat, label: 'Feed & Nutrition' },
  { to: '/finance', icon: DollarSign, label: 'Finances' },
  { to: '/sacco', icon: Building2, label: 'SACCO' },
  { to: '/sacco?tab=savings', icon: PiggyBank, label: 'SACCO Savings', isSubItem: true },
  { to: '/staff', icon: Users, label: 'Staff' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/reports', icon: FileText, label: 'Reports' },
  { to: '/notifications', icon: Bell, label: 'Notifications' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export default function Sidebar() {
  const { sidebarCollapsed, toggleSidebar, mobileMenuOpen, setMobileMenu } = useUIStore()
  const { logout, user } = useAuthStore()
  const { isOnline, isSyncing } = useSyncStore()
  const { unreadCount } = useNotificationStore()
  const navigate = useNavigate()

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-30 md:hidden"
            onClick={() => setMobileMenu(false)}
          />
        )}
      </AnimatePresence>

      <motion.aside
        animate={{ width: sidebarCollapsed ? 72 : 260 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className={`fixed left-0 top-0 h-full z-40 flex flex-col border-r overflow-hidden
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          transition-transform md:transition-none`}
        style={{
          background: 'linear-gradient(180deg, #0f172a 0%, #020617 100%)',
          borderColor: 'rgba(255,255,255,0.06)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <AnimatePresence mode="wait">
            {!sidebarCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }}
                className="flex items-center gap-2.5"
              >
                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold"
                  style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', boxShadow: '0 0 12px rgba(34,197,94,0.4)' }}>
                  J
                </div>
                <div>
                  <p className="font-display font-bold text-sm text-white leading-none">JBS Farm</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Management System</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {sidebarCollapsed && (
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold mx-auto"
              style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}>
              J
            </div>
          )}
          {!sidebarCollapsed && (
            <button onClick={toggleSidebar} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-slate-400">
              <ChevronLeft size={16} />
            </button>
          )}
        </div>

        {/* Online Status */}
        {!sidebarCollapsed && (
          <div className="px-4 py-2 flex items-center gap-2">
            <span className={`status-dot ${isSyncing ? 'syncing' : isOnline ? 'online' : 'offline'}`} />
            <span className="text-xs text-slate-500">
              {isSyncing ? 'Syncing...' : isOnline ? 'Online' : 'Offline mode'}
            </span>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
          {navItems.map(({ to, icon: Icon, label, isSubItem }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setMobileMenu(false)}
              className={({ isActive }) => 
                `sidebar-link ${isActive ? 'active' : ''} ${sidebarCollapsed ? 'justify-center' : ''} ${isSubItem && !sidebarCollapsed ? 'ml-4 pl-3 border-l border-white/10 text-[13px]' : ''}`
              }
              title={sidebarCollapsed ? label : undefined}
            >
              <div className="relative flex-shrink-0">
                <Icon size={isSubItem ? 15 : 18} />
                {to === '/notifications' && unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-red-500 text-white text-[8px] flex items-center justify-center font-bold">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </div>
              {!sidebarCollapsed && <span className="truncate">{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User + Collapse */}
        <div className="p-3 border-t space-y-1" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl mb-1" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}>
                {user?.name?.[0] || 'A'}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-white truncate">{user?.name || 'Admin'}</p>
                <p className="text-[10px] text-slate-500 capitalize">{user?.role || 'admin'}</p>
              </div>
            </div>
          )}
          {sidebarCollapsed && (
            <button onClick={toggleSidebar} className="sidebar-link w-full justify-center mb-1">
              <ChevronRight size={18} />
            </button>
          )}
          <button onClick={handleLogout} className={`sidebar-link w-full hover:text-red-400 ${sidebarCollapsed ? 'justify-center' : ''}`} title="Logout">
            <LogOut size={16} />
            {!sidebarCollapsed && <span>Logout</span>}
          </button>
        </div>
      </motion.aside>
    </>
  )
}
