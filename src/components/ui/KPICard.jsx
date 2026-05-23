import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { useEffect, useState } from 'react'

function useCountUp(target, duration = 1200) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!target) return
    const start = Date.now()
    const tick = () => {
      const elapsed = Date.now() - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(eased * target))
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [target, duration])
  return value
}

export default function KPICard({ title, value, unit = '', icon: Icon, color = 'green', trend, trendLabel, prefix = '', delay = 0 }) {
  const animated = useCountUp(typeof value === 'number' ? value : 0)

  const colorMap = {
    green: { bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.2)', icon: '#22c55e', glow: 'rgba(34,197,94,0.15)' },
    amber: { bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)', icon: '#f59e0b', glow: 'rgba(245,158,11,0.15)' },
    red:   { bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.2)',  icon: '#ef4444', glow: 'rgba(239,68,68,0.15)' },
    blue:  { bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.2)', icon: '#3b82f6', glow: 'rgba(59,130,246,0.15)' },
    purple:{ bg: 'rgba(168,85,247,0.1)', border: 'rgba(168,85,247,0.2)', icon: '#a855f7', glow: 'rgba(168,85,247,0.15)' },
  }
  const c = colorMap[color] || colorMap.green

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="glass-card p-5 flex flex-col gap-3 relative overflow-hidden"
    >
      {/* Background glow */}
      <div className="absolute top-0 right-0 w-24 h-24 rounded-full -translate-y-8 translate-x-8 opacity-40"
        style={{ background: `radial-gradient(circle, ${c.glow}, transparent 70%)` }} />

      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>{title}</span>
          <div className="flex items-baseline gap-1">
            {prefix && <span className="text-lg font-bold" style={{ color: c.icon }}>{prefix}</span>}
            <span className="font-display font-bold text-2xl text-white">
              {typeof value === 'number' ? animated.toLocaleString() : value}
            </span>
            {unit && <span className="text-sm text-slate-400">{unit}</span>}
          </div>
        </div>
        {Icon && (
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: c.bg, border: `1px solid ${c.border}` }}>
            <Icon size={20} style={{ color: c.icon }} />
          </div>
        )}
      </div>

      {(trend !== undefined || trendLabel) && (
        <div className="flex items-center gap-1.5">
          {trend !== undefined && (
            <>
              {trend > 0 ? <TrendingUp size={13} className="text-green-400" /> :
               trend < 0 ? <TrendingDown size={13} className="text-red-400" /> :
               <Minus size={13} className="text-slate-400" />}
              <span className={`text-xs font-medium ${trend > 0 ? 'text-green-400' : trend < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                {trend > 0 ? '+' : ''}{trend}%
              </span>
            </>
          )}
          {trendLabel && <span className="text-xs text-slate-500">{trendLabel}</span>}
        </div>
      )}
    </motion.div>
  )
}
