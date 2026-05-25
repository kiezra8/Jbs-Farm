import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { useBreedingStore } from '../../store/useBreedingStore'
import { useAnimalStore } from '../../store/useAnimalStore'
import DataTable from '../../components/ui/DataTable'
import { Badge } from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import { format } from 'date-fns'

export default function Breeding() {
  const { records, loadRecords, getStats, addRecord } = useBreedingStore()
  const { animals, loadAnimals } = useAnimalStore()
  const [isModalOpen, setIsModalOpen] = useState(false)

  const [formData, setFormData] = useState({ animalId: '', type: 'Artificial', date: format(new Date(), 'yyyy-MM-dd'), bull: '', status: 'Pending Check', expectedCalving: '', notes: '' })

  useEffect(() => { loadRecords(); loadAnimals() }, [])

  const stats = getStats()
  const enhancedRecords = records.map(r => {
    const animal = animals.find(a => a.id === r.animalId)
    return { ...r, animalName: animal?.name, tagNumber: animal?.tagNumber }
  })

  const handleSave = async (e) => {
    e.preventDefault()
    await addRecord({ ...formData, animalId: Number(formData.animalId) })
    setIsModalOpen(false)
    setFormData({ animalId: '', type: 'Artificial', date: format(new Date(), 'yyyy-MM-dd'), bull: '', status: 'Pending Check', expectedCalving: '', notes: '' })
  }

  const columns = [
    { key: 'date', label: 'Date', render: (val) => format(new Date(val), 'dd MMM yyyy') },
    { key: 'tagNumber', label: 'Cow', render: (val, row) => (
      <div><p className="font-medium text-white">{val}</p><p className="text-xs text-slate-400">{row.animalName}</p></div>
    )},
    { key: 'type', label: 'Method', render: (val) => <Badge variant={val === 'Artificial' ? 'blue' : 'gray'}>{val}</Badge> },
    { key: 'bull', label: 'Bull / Sire' },
    { key: 'status', label: 'Status', render: (val) => {
      let v = 'gray'; if (val === 'Confirmed Pregnant') v = 'purple'; if (val === 'Calved') v = 'green'; if (val === 'Open') v = 'red';
      return <Badge variant={v}>{val}</Badge>
    }},
    { key: 'expectedCalving', label: 'Expected Calving', render: (val) => val ? format(new Date(val), 'dd MMM yyyy') : '—' },
  ]

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Breeding Management</h1>
          <p className="text-slate-400 text-sm mt-1">Track Artificial, natural mating, pregnancies, and calving.</p>
        </div>
        <button className="btn-primary" onClick={() => setIsModalOpen(true)}><Plus size={16} /> Add Record</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-4 flex items-center justify-between border-l-2 border-l-purple-500">
          <div><p className="text-xs text-slate-400">Pregnant Cows</p><p className="text-2xl font-display font-bold text-white">{stats.pregnant}</p></div><span className="text-2xl opacity-80">🤰</span>
        </div>
        <div className="glass-card p-4 flex items-center justify-between border-l-2 border-l-blue-500">
          <div><p className="text-xs text-slate-400">Artificial Services</p><p className="text-2xl font-display font-bold text-white">{stats.ai}</p></div><span className="text-2xl opacity-80">🧬</span>
        </div>
        <div className="glass-card p-4 flex items-center justify-between border-l-2 border-l-green-500">
          <div><p className="text-xs text-slate-400">Calved</p><p className="text-2xl font-display font-bold text-white">{stats.calved}</p></div><span className="text-2xl opacity-80">🐄</span>
        </div>
        <div className="glass-card p-4 flex items-center justify-between border-l-2 border-l-amber-500">
          <div><p className="text-xs text-slate-400">Heat Cycles</p><p className="text-2xl font-display font-bold text-white">{stats.heatCycles}</p></div><span className="text-2xl opacity-80">🔥</span>
        </div>
      </div>

      <div className="glass-card p-5">
        <DataTable columns={columns} data={enhancedRecords} pageSize={10} />
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Breeding Record">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Cow *</label>
              <select required className="input-field" value={formData.animalId} onChange={e => setFormData({...formData, animalId: e.target.value})}>
                <option value="">Select Cow...</option>
                {animals.filter(a => a.gender === 'Female').map(a => <option key={a.id} value={a.id}>{a.tagNumber} ({a.name || 'Unnamed'})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Method *</label>
              <select required className="input-field" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                <option>Artificial</option><option>Natural</option><option>Heat Cycle</option>
              </select>
            </div>
            <div><label className="block text-xs font-medium text-slate-400 mb-1">Date *</label><input required type="date" className="input-field" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} /></div>
            <div><label className="block text-xs font-medium text-slate-400 mb-1">Sire / Bull</label><input type="text" className="input-field" value={formData.bull} onChange={e => setFormData({...formData, bull: e.target.value})} /></div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Status</label>
              <select className="input-field" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                <option>Pending Check</option><option>Confirmed Pregnant</option><option>Open</option><option>Calved</option>
              </select>
            </div>
            <div><label className="block text-xs font-medium text-slate-400 mb-1">Expected Calving</label><input type="date" className="input-field" value={formData.expectedCalving} onChange={e => setFormData({...formData, expectedCalving: e.target.value})} /></div>
            <div className="col-span-2"><label className="block text-xs font-medium text-slate-400 mb-1">Notes</label><input type="text" className="input-field" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} /></div>
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
