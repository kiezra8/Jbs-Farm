import { useEffect, useState } from 'react'
import { LineChart, Line, BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { useMilkStore } from '../../store/useMilkStore'
import { useFinanceStore } from '../../store/useFinanceStore'
import { formatKES } from '../../utils/formatters'

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="glass-card px-3 py-2 text-xs">
      <p className="text-slate-400 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: {typeof p.value === 'number' && p.name?.includes('Income') ? formatKES(p.value) : p.value}</p>
      ))}
    </div>
  )
}

export default function Analytics() {
  const { loadRecords: loadMilk, getDailyTotals } = useMilkStore()
  const { loadTransactions, getMonthlyTrend } = useFinanceStore()
  
  const [milkData, setMilkData] = useState([])
  const [financeData, setFinanceData] = useState([])

  useEffect(() => {
    Promise.all([loadMilk(), loadTransactions()]).then(() => {
      setMilkData(getDailyTotals(30))
      setFinanceData(getMonthlyTrend(6).reverse())
    })
  }, [])

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Analytics & Intelligence</h1>
          <p className="text-slate-400 text-sm mt-1">Enterprise business intelligence dashboards.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Milk 30-day Trend */}
        <div className="glass-card p-5">
          <h3 className="font-display font-semibold text-white mb-6">30-Day Milk Production</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={milkData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={20} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="total" name="Liters" stroke="#3b82f6" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: '#3b82f6', stroke: 'transparent' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Financial Trend */}
        <div className="glass-card p-5">
          <h3 className="font-display font-semibold text-white mb-6">Financial Performance (6 Months)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={financeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="income" name="Income" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
