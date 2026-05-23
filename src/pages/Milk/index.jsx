import { useEffect } from 'react'
import { Plus } from 'lucide-react'
import { useMilkStore } from '../../store/useMilkStore'
import { useAnimalStore } from '../../store/useAnimalStore'
import DataTable from '../../components/ui/DataTable'
import { Badge } from '../../components/ui/Badge'
import { formatLiters } from '../../utils/formatters'
import { format } from 'date-fns'

export default function Milk() {
  const { records, loadRecords, getStats } = useMilkStore()
  const { animals, loadAnimals } = useAnimalStore()

  useEffect(() => {
    loadRecords()
    loadAnimals()
  }, [])

  const stats = getStats()

  const enhancedRecords = records.map(r => {
    const animal = animals.find(a => a.id === r.animalId)
    return { ...r, animalName: animal?.name, tagNumber: animal?.tagNumber }
  })

  const columns = [
    { key: 'date', label: 'Date', render: (val) => format(new Date(val), 'dd MMM yyyy') },
    { key: 'tagNumber', label: 'Cow', render: (val, row) => (
      <div>
        <p className="font-medium text-white">{val}</p>
        <p className="text-xs text-slate-400">{row.animalName}</p>
      </div>
    )},
    { key: 'session', label: 'Session', render: (val) => <Badge variant={val === 'Morning' ? 'blue' : 'purple'}>{val}</Badge> },
    { key: 'amount', label: 'Amount (Liters)', render: (val) => formatLiters(val) },
  ]

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Milk Production</h1>
          <p className="text-slate-400 text-sm mt-1">Track daily milking sessions and cow performance.</p>
        </div>
        <button className="btn-primary"><Plus size={16} /> Add Yield</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-4 flex items-center justify-between border-l-2 border-l-blue-500">
          <div><p className="text-xs text-slate-400">Today's Total</p><p className="text-2xl font-display font-bold text-white">{formatLiters(stats.todayTotal)}</p></div>
          <span className="text-2xl opacity-80">🥛</span>
        </div>
        <div className="glass-card p-4 flex items-center justify-between border-l-2 border-l-amber-500">
          <div><p className="text-xs text-slate-400">Yesterday</p><p className="text-2xl font-display font-bold text-white">{formatLiters(stats.yesterdayTotal)}</p></div>
          <span className="text-2xl opacity-80">📉</span>
        </div>
        <div className="glass-card p-4 flex items-center justify-between border-l-2 border-l-green-500">
          <div><p className="text-xs text-slate-400">Change</p>
            <p className={`text-2xl font-display font-bold ${stats.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {stats.change > 0 ? '+' : ''}{stats.change}%
            </p>
          </div>
          <span className="text-2xl opacity-80">📊</span>
        </div>
        <div className="glass-card p-4 flex items-center justify-between border-l-2 border-l-purple-500">
          <div><p className="text-xs text-slate-400">This Month</p><p className="text-2xl font-display font-bold text-white">{formatLiters(stats.monthTotal)}</p></div>
          <span className="text-2xl opacity-80">🗓️</span>
        </div>
      </div>

      <div className="glass-card p-5">
        <DataTable columns={columns} data={enhancedRecords} pageSize={10} />
      </div>
    </div>
  )
}
