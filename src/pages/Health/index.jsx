import { useEffect } from 'react'
import { Plus, Search, Filter, Calendar } from 'lucide-react'
import { useHealthStore } from '../../store/useHealthStore'
import { useAnimalStore } from '../../store/useAnimalStore'
import DataTable from '../../components/ui/DataTable'
import { HealthBadge } from '../../components/ui/Badge'
import { formatKES } from '../../utils/formatters'
import { format } from 'date-fns'

export default function Health() {
  const { records, loadRecords, getStats } = useHealthStore()
  const { animals, loadAnimals } = useAnimalStore()

  useEffect(() => {
    loadRecords()
    loadAnimals()
  }, [])

  const stats = getStats()

  // Map animal info into records
  const enhancedRecords = records.map(r => {
    const animal = animals.find(a => a.id === r.animalId)
    return { ...r, animalName: animal?.name, tagNumber: animal?.tagNumber }
  })

  const columns = [
    { key: 'date', label: 'Date', render: (val) => format(new Date(val), 'dd MMM yyyy') },
    { key: 'tagNumber', label: 'Animal Tag', render: (val, row) => (
      <div>
        <p className="font-medium text-white">{val}</p>
        <p className="text-xs text-slate-400">{row.animalName}</p>
      </div>
    )},
    { key: 'type', label: 'Event Type', render: (val) => <HealthBadge type={val} /> },
    { key: 'details', label: 'Details', sortable: false, render: (_, row) => (
      <span className="text-slate-300">
        {row.type === 'Treatment' ? row.diagnosis : row.type === 'Vaccination' ? row.vaccine : row.notes || '—'}
      </span>
    )},
    { key: 'cost', label: 'Cost', render: (val) => formatKES(val) },
    { key: 'status', label: 'Status', render: (val) => (
      <span className={`text-xs font-medium px-2 py-1 rounded-full ${val === 'Completed' ? 'bg-green-500/10 text-green-400' : 'bg-amber-500/10 text-amber-400'}`}>
        {val || 'Completed'}
      </span>
    )},
  ]

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Health Management</h1>
          <p className="text-slate-400 text-sm mt-1">Track vaccinations, treatments, and vet visits.</p>
        </div>
        <button className="btn-primary">
          <Plus size={16} />
          Add Record
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-4 flex items-center justify-between border-l-2 border-l-blue-500">
          <div><p className="text-xs text-slate-400">Vaccinations</p><p className="text-2xl font-display font-bold text-white">{stats.vaccinations}</p></div>
          <span className="text-2xl opacity-80">💉</span>
        </div>
        <div className="glass-card p-4 flex items-center justify-between border-l-2 border-l-red-500">
          <div><p className="text-xs text-slate-400">Treatments</p><p className="text-2xl font-display font-bold text-white">{stats.treatments}</p></div>
          <span className="text-2xl opacity-80">🏥</span>
        </div>
        <div className="glass-card p-4 flex items-center justify-between border-l-2 border-l-amber-500">
          <div><p className="text-xs text-slate-400">Deworming</p><p className="text-2xl font-display font-bold text-white">{stats.deworming}</p></div>
          <span className="text-2xl opacity-80">🔬</span>
        </div>
        <div className="glass-card p-4 flex items-center justify-between border-l-2 border-l-purple-500">
          <div><p className="text-xs text-slate-400">Vet Visits</p><p className="text-2xl font-display font-bold text-white">{stats.vetVisits}</p></div>
          <span className="text-2xl opacity-80">👨‍⚕️</span>
        </div>
      </div>

      <div className="glass-card p-5">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="search-bar flex-1">
            <Search size={16} className="text-slate-400" />
            <input type="text" placeholder="Search by tag, disease, or vaccine..." className="bg-transparent border-none outline-none w-full text-white placeholder:text-slate-500" />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <Filter size={16} className="text-slate-400" />
              <select className="bg-transparent border-none outline-none text-sm text-white">
                <option value="">All Types</option>
                <option value="Vaccination">Vaccination</option>
                <option value="Treatment">Treatment</option>
                <option value="Deworming">Deworming</option>
              </select>
            </div>
            <button className="btn-secondary px-3"><Calendar size={16} /></button>
          </div>
        </div>

        <DataTable columns={columns} data={enhancedRecords} pageSize={10} />
      </div>
    </div>
  )
}
