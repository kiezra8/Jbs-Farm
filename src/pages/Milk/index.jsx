import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { useMilkStore } from '../../store/useMilkStore'
import { useAnimalStore } from '../../store/useAnimalStore'
import DataTable from '../../components/ui/DataTable'
import { Badge } from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import { formatLiters } from '../../utils/formatters'
import { format } from 'date-fns'

export default function Milk() {
  const { records, loadRecords, getStats, addRecord } = useMilkStore()
  const { animals, loadAnimals } = useAnimalStore()
  const [isModalOpen, setIsModalOpen] = useState(false)

  const [formData, setFormData] = useState({ animalId: '', date: format(new Date(), 'yyyy-MM-dd'), session: 'Morning', amount: '' })

  useEffect(() => { loadRecords(); loadAnimals() }, [])

  const stats = getStats()
  const enhancedRecords = records.map(r => {
    const animal = animals.find(a => a.id === r.animalId)
    return { ...r, animalName: animal?.name, tagNumber: animal?.tagNumber }
  })

  const handleSave = async (e) => {
    e.preventDefault()
    await addRecord({ ...formData, animalId: Number(formData.animalId), amount: Number(formData.amount) || 0 })
    setIsModalOpen(false)
    setFormData({ animalId: '', date: format(new Date(), 'yyyy-MM-dd'), session: 'Morning', amount: '' })
  }

  const columns = [
    { key: 'date', label: 'Date', render: (val) => format(new Date(val), 'dd MMM yyyy') },
    { key: 'tagNumber', label: 'Cow', render: (val, row) => (
      <div><p className="font-medium text-white">{val}</p><p className="text-xs text-slate-400">{row.animalName}</p></div>
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
        <button className="btn-primary" onClick={() => setIsModalOpen(true)}><Plus size={16} /> Add Yield</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-4 flex items-center justify-between border-l-2 border-l-blue-500">
          <div><p className="text-xs text-slate-400">Today's Total</p><p className="text-2xl font-display font-bold text-white">{formatLiters(stats.todayTotal)}</p></div><span className="text-2xl opacity-80">🥛</span>
        </div>
        <div className="glass-card p-4 flex items-center justify-between border-l-2 border-l-amber-500">
          <div><p className="text-xs text-slate-400">Yesterday</p><p className="text-2xl font-display font-bold text-white">{formatLiters(stats.yesterdayTotal)}</p></div><span className="text-2xl opacity-80">📉</span>
        </div>
        <div className="glass-card p-4 flex items-center justify-between border-l-2 border-l-green-500">
          <div><p className="text-xs text-slate-400">Change</p><p className={`text-2xl font-display font-bold ${stats.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>{stats.change > 0 ? '+' : ''}{stats.change}%</p></div><span className="text-2xl opacity-80">📊</span>
        </div>
        <div className="glass-card p-4 flex items-center justify-between border-l-2 border-l-purple-500">
          <div><p className="text-xs text-slate-400">This Month</p><p className="text-2xl font-display font-bold text-white">{formatLiters(stats.monthTotal)}</p></div><span className="text-2xl opacity-80">🗓️</span>
        </div>
      </div>

      <div className="glass-card p-5">
        <DataTable columns={columns} data={enhancedRecords} pageSize={10} />
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Milk Yield">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-400 mb-1">Cow *</label>
              <select required className="input-field" value={formData.animalId} onChange={e => setFormData({...formData, animalId: e.target.value})}>
                <option value="">Select Milking Cow...</option>
                {animals.filter(a => a.gender === 'Female').map(a => <option key={a.id} value={a.id}>{a.tagNumber} ({a.name || 'Unnamed'})</option>)}
              </select>
            </div>
            <div><label className="block text-xs font-medium text-slate-400 mb-1">Date *</label><input required type="date" className="input-field" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} /></div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Session *</label>
              <select required className="input-field" value={formData.session} onChange={e => setFormData({...formData, session: e.target.value})}>
                <option>Morning</option><option>Evening</option>
              </select>
            </div>
            <div className="col-span-2"><label className="block text-xs font-medium text-slate-400 mb-1">Amount (Liters) *</label><input required type="number" step="0.1" className="input-field" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} /></div>
          </div>
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary">Save Record</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
