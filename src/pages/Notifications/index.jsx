import { useEffect } from 'react'
import { Check, Trash2, BellOff } from 'lucide-react'
import { useNotificationStore } from '../../store/useNotificationStore'
import { format } from 'date-fns'

export default function Notifications() {
  const { notifications, loadNotifications, markRead, markAllRead, clearAll, unreadCount } = useNotificationStore()

  useEffect(() => {
    loadNotifications()
  }, [])

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Notifications</h1>
          <p className="text-slate-400 text-sm mt-1">You have {unreadCount} unread messages.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={markAllRead} className="btn-secondary" disabled={unreadCount === 0}><Check size={16} /> Mark all read</button>
          <button onClick={clearAll} className="btn-secondary text-red-400 hover:bg-red-500/10" disabled={notifications.length === 0}><Trash2 size={16} /> Clear all</button>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        {notifications.length === 0 ? (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center">
            <BellOff size={32} className="mb-3 opacity-50" />
            <p>No notifications</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
            {notifications.map(n => (
              <div key={n.id} 
                className={`p-4 flex items-start gap-4 transition-colors ${!n.read ? 'bg-white/5' : 'hover:bg-white/5'}`}
                onClick={() => !n.read && markRead(n.id)}
              >
                <div className="text-2xl mt-1">{n.icon || '🔔'}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <h4 className={`text-sm ${!n.read ? 'text-white font-semibold' : 'text-slate-300 font-medium'}`}>{n.title}</h4>
                    <span className="text-xs text-slate-500 whitespace-nowrap ml-4">{format(new Date(n.createdAt), 'dd MMM, HH:mm')}</span>
                  </div>
                  <p className={`text-sm ${!n.read ? 'text-slate-300' : 'text-slate-500'}`}>{n.message}</p>
                </div>
                {!n.read && <div className="w-2.5 h-2.5 rounded-full bg-green-500 mt-2 flex-shrink-0" />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
