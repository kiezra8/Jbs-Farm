import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Beef, Heart, Baby, Milk, Wheat, DollarSign, Users, TrendingUp, AlertTriangle, Activity, Lightbulb, RefreshCw } from 'lucide-react'
import { LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts'
import KPICard from '../../components/ui/KPICard'
import { useAnimalStore } from '../../store/useAnimalStore'
import { useHealthStore } from '../../store/useHealthStore'
import { useBreedingStore } from '../../store/useBreedingStore'
import { useMilkStore } from '../../store/useMilkStore'
import { useFeedStore } from '../../store/useFeedStore'
import { useFinanceStore } from '../../store/useFinanceStore'
import { useStaffStore } from '../../store/useStaffStore'
import { useNotificationStore } from '../../store/useNotificationStore'
import { generateInsights } from '../../services/analyticsEngine'
import { formatUGX } from '../../utils/formatters'
import { format } from 'date-fns'

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4']

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="glass-card px-3 py-2 text-xs">
      <p className="text-slate-400 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: {typeof p.value === 'number' && p.name?.includes('Ushs') ? formatUGX(p.value) : p.value?.toFixed ? p.value.toFixed(1) : p.value}</p>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const [insights, setInsights] = useState([])
  const [loadingInsights, setLoadingInsights] = useState(true)

  const { animals, loadAnimals, getStats: getAnimalStats } = useAnimalStore()
  const { records: healthRecords, loadRecords: loadHealth } = useHealthStore()
  const { records: breedingRecords, loadRecords: loadBreeding } = useBreedingStore()
  const { records: milkRecords, loadRecords: loadMilk, getDailyTotals, getTodayTotal, getStats: getMilkStats } = useMilkStore()
  const { inventory, loadAll: loadFeed, getLowStockItems } = useFeedStore()
  const { transactions, loadTransactions, getMonthlyStats } = useFinanceStore()
  const { staff, loadAll: loadStaff, getStats: getStaffStats } = useStaffStore()
  const { notifications, loadNotifications } = useNotificationStore()

  useEffect(() => {
    Promise.all([loadAnimals(), loadHealth(), loadBreeding(), loadMilk(), loadFeed(), loadTransactions(), loadStaff(), loadNotifications()])
      .then(() => {
        // Voice alarm for missing milk
        if (getTodayTotal() === 0 && window.speechSynthesis) {
          const utterance = new SpeechSynthesisUtterance("Milk is missing for today. Please update the milk records.");
          window.speechSynthesis.speak(utterance);
        }

        generateInsights().then(ins => {
          setInsights(ins)
          setLoadingInsights(false)
        })
      })
  }, [])

  const animalStats = getAnimalStats()
  const milkStats = getMilkStats()
  const staffStats = getStaffStats()
  const monthFinance = getMonthlyStats()
  const lowStock = getLowStockItems()
  const milkTrend = getDailyTotals(14)

  const healthDist = [
    { name: 'Healthy', value: animalStats.healthy },
    { name: 'Sick', value: animalStats.sick },
    { name: 'Pregnant', value: animalStats.pregnant },
    { name: 'Calves', value: animalStats.calves },
  ].filter(d => d.value > 0)

  const recentActivity = notifications.slice(0, 6)

  return (
    <div className="space-y-6">
      {/* KPI Row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Total Cattle" value={animalStats.total} icon={Beef} color="green" trendLabel="Head of cattle" delay={0} />
        <KPICard title="Today's Milk" value={milkStats.todayTotal} unit="L" icon={Milk} color="blue"
          trend={milkStats.change} trendLabel="vs yesterday" delay={0.05} />
        <KPICard title="Sick Animals" value={animalStats.sick} icon={Heart} color="red"
          trendLabel={animalStats.sick > 0 ? 'Need attention' : 'All healthy'} delay={0.1} />
        <KPICard title="Pregnant Cows" value={animalStats.pregnant} icon={Baby} color="purple" trendLabel="Confirmed" delay={0.15} />
      </div>

      {/* KPI Row 2 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Monthly Revenue" value={monthFinance.income} prefix="Ushs" icon={DollarSign} color="green"
          trendLabel="This month" delay={0.2} />
        <KPICard title="Monthly Expenses" value={monthFinance.expenses} prefix="Ushs" icon={TrendingUp} color="amber"
          trendLabel="This month" delay={0.25} />
        <KPICard title="Staff Present" value={staffStats.present} icon={Users} color="blue"
          trendLabel={`of ${staffStats.total} staff today`} delay={0.3} />
        <KPICard title="Low Stock Feeds" value={lowStock.length} icon={Wheat} color={lowStock.length > 0 ? 'red' : 'green'}
          trendLabel={lowStock.length > 0 ? 'Need restocking' : 'All stocked'} delay={0.35} />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Milk Trend */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="glass-card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-white">14-Day Milk Production</h3>
            <span className="badge-blue badge">Last 14 days</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={milkTrend}>
              <defs>
                <linearGradient id="milkGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} interval={1} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="total" name="Litres" stroke="#22c55e" strokeWidth={2} fill="url(#milkGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Herd Health Donut */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
          className="glass-card p-5">
          <h3 className="font-display font-semibold text-white mb-4">Herd Health Status</h3>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={healthDist} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                {healthDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-2">
            {healthDist.map((d, i) => (
              <div key={d.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i] }} />
                  <span className="text-slate-400">{d.name}</span>
                </div>
                <span className="text-white font-medium">{d.value}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Bottom Row: Smart Insights + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Smart Insights */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.25)' }}>
              <Lightbulb size={15} className="text-amber-400" />
            </div>
            <h3 className="font-display font-semibold text-white">Smart Insights</h3>
          </div>
          {loadingInsights ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="skeleton h-12 rounded-xl" />)}
            </div>
          ) : (
            <div className="space-y-2">
              {insights.map((ins, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + i * 0.08 }}
                  className={`flex items-start gap-3 p-3 rounded-xl text-sm ${
                    ins.type === 'danger' ? 'bg-red-500/10 border border-red-500/15' :
                    ins.type === 'warning' ? 'bg-amber-500/10 border border-amber-500/15' :
                    ins.type === 'success' ? 'bg-green-500/10 border border-green-500/15' :
                    'bg-blue-500/10 border border-blue-500/15'
                  }`}>
                  <span className="text-base flex-shrink-0 mt-0.5">{ins.icon}</span>
                  <span className="text-slate-300 leading-snug">{ins.text}</span>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Recent Activity */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}
          className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.25)' }}>
              <Activity size={15} className="text-blue-400" />
            </div>
            <h3 className="font-display font-semibold text-white">Recent Activity</h3>
          </div>
          <div className="space-y-2">
            {recentActivity.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-6">No recent activity</p>
            ) : recentActivity.map((n, i) => (
              <motion.div key={n.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.55 + i * 0.07 }}
                className="flex items-start gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors cursor-default"
              >
                <span className="text-lg flex-shrink-0">{n.icon}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{n.title}</p>
                  <p className="text-xs text-slate-400 truncate">{n.message}</p>
                  <p className="text-[10px] text-slate-600 mt-0.5">{format(new Date(n.createdAt), 'MMM d, HH:mm')}</p>
                </div>
                {!n.read && <div className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0 mt-1.5" />}
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
