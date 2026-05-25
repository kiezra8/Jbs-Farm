import { useEffect, useState } from 'react'
import { Plus, Search, Filter, Calendar } from 'lucide-react'
import { useHealthStore } from '../../store/useHealthStore'
import { useAnimalStore } from '../../store/useAnimalStore'
import DataTable from '../../components/ui/DataTable'
import { HealthBadge } from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import { formatUGX } from '../../utils/formatters'
import { format } from 'date-fns'

export default function Health() {
  const { records, loadRecords, getStats, addRecord } = useHealthStore()
  const { animals, loadAnimals } = useAnimalStore()
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Form State
  const [formData, setFormData] = useState({ animalId: '', type: 'Treatment', date: format(new Date(), 'yyyy-MM-dd'), diagnosis: '', treatment: '', vaccine: '', vet: '', cost: '', notes: '', nextDue: '' })

  useEffect(() => { loadRecords(); loadAnimals() }, [])

  const stats = getStats()
  const enhancedRecords = records.map(r => {
    const animal = animals.find(a => a.id === r.animalId)
    return { ...r, animalName: animal?.name, tagNumber: animal?.tagNumber }
  })

  const handleSave = async (e) => {
    e.preventDefault()
    await addRecord({
      ...formData,
      animalId: Number(formData.animalId),
      cost: Number(formData.cost) || 0
    })
    setIsModalOpen(false)
    setFormData({ animalId: '', type: 'Treatment', date: format(new Date(), 'yyyy-MM-dd'), diagnosis: '', treatment: '', vaccine: '', vet: '', cost: '', notes: '', nextDue: '' })
  }

  const columns = [
    { key: 'date', label: 'Date', render: (val) => format(new Date(val), 'dd MMM yyyy') },
    { key: 'tagNumber', label: 'Animal Tag', render: (val, row) => (
      <div><p className="font-medium text-white">{val}</p><p className="text-xs text-slate-400">{row.animalName}</p></div>
    )},
    { key: 'type', label: 'Event Type', render: (val) => <HealthBadge type={val} /> },
    { key: 'details', label: 'Details', sortable: false, render: (_, row) => (
      <span className="text-slate-300">{row.type === 'Treatment' ? row.diagnosis : row.type === 'Vaccination' ? row.vaccine : row.notes || '—'}</span>
    )},
    { key: 'cost', label: 'Cost', render: (val) => formatUGX(val) },
    { key: 'status', label: 'Status', render: (val) => (
      <span className={`text-xs font-medium px-2 py-1 rounded-full ${val === 'Completed' ? 'bg-green-500/10 text-green-400' : 'bg-amber-500/10 text-amber-400'}`}>{val || 'Completed'}</span>
    )},
  ]

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Health Management</h1>
          <p className="text-slate-400 text-sm mt-1">Track vaccinations, treatments, and vet visits.</p>
        </div>
        <button className="btn-primary" onClick={() => setIsModalOpen(true)}><Plus size={16} /> Add Record</button>
      </div>

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
        <DataTable columns={columns} data={enhancedRecords} pageSize={10} />
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Health Record">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Animal *</label>
              <select required className="input-field" value={formData.animalId} onChange={e => setFormData({...formData, animalId: e.target.value})}>
                <option value="">Select Animal...</option>
                {animals.map(a => <option key={a.id} value={a.id}>{a.tagNumber} ({a.name || 'Unnamed'})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Record Type *</label>
              <select required className="input-field" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                <option>Treatment</option><option>Vaccination</option><option>Deworming</option><option>Vet Visit</option><option>Mortality</option>
              </select>
            </div>
            <div><label className="block text-xs font-medium text-slate-400 mb-1">Date *</label><input required type="date" className="input-field" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} /></div>
            <div><label className="block text-xs font-medium text-slate-400 mb-1">Cost (Ushs)</label><input type="number" className="input-field" value={formData.cost} onChange={e => setFormData({...formData, cost: e.target.value})} /></div>
            
            {formData.type === 'Treatment' && (
              <>
                <div><label className="block text-xs font-medium text-slate-400 mb-1">Diagnosis</label><input type="text" className="input-field" value={formData.diagnosis} onChange={e => setFormData({...formData, diagnosis: e.target.value})} /></div>
                <div><label className="block text-xs font-medium text-slate-400 mb-1">Treatment Given</label><input type="text" className="input-field" value={formData.treatment} onChange={e => setFormData({...formData, treatment: e.target.value})} /></div>
              </>
            )}
            {formData.type === 'Vaccination' && (
              <>
                <div><label className="block text-xs font-medium text-slate-400 mb-1">Vaccine Name</label><input type="text" className="input-field" value={formData.vaccine} onChange={e => setFormData({...formData, vaccine: e.target.value})} /></div>
                <div><label className="block text-xs font-medium text-slate-400 mb-1">Next Due Date</label><input type="date" className="input-field" value={formData.nextDue} onChange={e => setFormData({...formData, nextDue: e.target.value})} /></div>
              </>
            )}
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
