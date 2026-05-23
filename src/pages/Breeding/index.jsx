import { useEffect } from 'react'
import { Plus, Search, Calendar } from 'lucide-react'
import { useBreedingStore } from '../../store/useBreedingStore'
import { useAnimalStore } from '../../store/useAnimalStore'
import DataTable from '../../components/ui/DataTable'
import { Badge } from '../../components/ui/Badge'
import { format } from 'date-fns'

export default function Breeding() {
  const { records, loadRecords, getStats } = useBreedingStore()
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
    { key: 'type', label: 'Method', render: (val) => <Badge variant={val === 'AI' ? 'blue' : 'gray'}>{val}</Badge> },
    { key: 'bull', label: 'Bull / Sire' },
    { key: 'status', label: 'Status', render: (val) => {
      let v = 'gray'
      if (val === 'Confirmed Pregnant') v = 'purple'
      if (val === 'Calved') v = 'green'
      if (val === 'Open') v = 'red'
      return <Badge variant={v}>{val}</Badge>
    }},
    { key: 'expectedCalving', label: 'Expected Calving', render: (val) => val ? format(new Date(val), 'dd MMM yyyy') : '—' },
  ]

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Breeding Management</h1>
          <p className="text-slate-400 text-sm mt-1">Track AI, natural mating, pregnancies, and calving.</p>
        </div>
        <button className="btn-primary"><Plus size={16} /> Add Record</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-4 flex items-center justify-between border-l-2 border-l-purple-500">
          <div><p className="text-xs text-slate-400">Pregnant Cows</p><p className="text-2xl font-display font-bold text-white">{stats.pregnant}</p></div>
          <span className="text-2xl opacity-80">🤰</span>
        </div>
        <div className="glass-card p-4 flex items-center justify-between border-l-2 border-l-blue-500">
          <div><p className="text-xs text-slate-400">AI Services</p><p className="text-2xl font-display font-bold text-white">{stats.ai}</p></div>
          <span className="text-2xl opacity-80">🧬</span>
        </div>
        <div className="glass-card p-4 flex items-center justify-between border-l-2 border-l-green-500">
          <div><p className="text-xs text-slate-400">Calved</p><p className="text-2xl font-display font-bold text-white">{stats.calved}</p></div>
          <span className="text-2xl opacity-80">🐄</span>
        </div>
        <div className="glass-card p-4 flex items-center justify-between border-l-2 border-l-amber-500">
          <div><p className="text-xs text-slate-400">Heat Cycles</p><p className="text-2xl font-display font-bold text-white">{stats.heatCycles}</p></div>
          <span className="text-2xl opacity-80">🔥</span>
        </div>
      </div>

      <div className="glass-card p-5">
        <DataTable columns={columns} data={enhancedRecords} pageSize={10} />
      </div>
    </div>
  )
}
