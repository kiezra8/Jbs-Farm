import { motion } from 'framer-motion'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { useUIStore } from '../../store/useUIStore'

export default function AppLayout({ children }) {
  const { sidebarCollapsed } = useUIStore()

  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <div
        className="flex-1 flex flex-col min-w-0 transition-all duration-300"
        style={{ marginLeft: sidebarCollapsed ? 72 : 260 }}
      >
        <Topbar />
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {children}
          </motion.div>
        </main>
      </div>
      {/* Mobile: no margin */}
      <style>{`@media(max-width:768px){.flex-1.flex.flex-col{margin-left:0!important}}`}</style>
    </div>
  )
}
