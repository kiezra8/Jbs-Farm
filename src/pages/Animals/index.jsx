import { useEffect, useState } from 'react'
import { Plus, Search, Filter, QrCode, Edit2, Trash2, Beef } from 'lucide-react'
import { useAnimalStore } from '../../store/useAnimalStore'
import DataTable from '../../components/ui/DataTable'
import { StatusBadge, Badge } from '../../components/ui/Badge'
import { formatAge, formatWeight } from '../../utils/formatters'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { QRCodeSVG } from 'qrcode.react'

export default function Animals() {
  const { animals, loadAnimals, getFilteredAnimals, getStats, setSearchQuery, searchQuery, filters, setFilter, deleteAnimal, addAnimal, updateAnimal } = useAnimalStore()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isQRModalOpen, setIsQRModalOpen] = useState(false)
  const [selectedAnimal, setSelectedAnimal] = useState(null)
  const [editingAnimal, setEditingAnimal] = useState(null)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isSickModalOpen, setIsSickModalOpen] = useState(false)

  const initialForm = {
    tagNumber: '', name: '', breed: 'Friesian', gender: 'Female', status: 'Healthy', weight: '', age: '', dob: '', purchaseDate: '', purchasePrice: '', color: '', notes: ''
  }

  // Form State
  const [formData, setFormData] = useState(initialForm)

  useEffect(() => { loadAnimals() }, [])

  const filteredData = getFilteredAnimals()
  const stats = getStats()

  const handleSave = async (e) => {
    e.preventDefault()
    try {
      const payload = {
        ...formData,
        weight: Number(formData.weight) || 0,
        age: Number(formData.age) || 0,
        purchasePrice: Number(formData.purchasePrice) || 0
      }
      if (editingAnimal) {
        await updateAnimal(editingAnimal.id, payload)
      } else {
        await addAnimal(payload)
      }
      setIsModalOpen(false)
      setEditingAnimal(null)
      setFormData(initialForm)
    } catch (err) {
      console.error('Save failed:', err)
      alert(`Failed to save: ${err.message}`)
    }
  }

  const columns = [
    { key: 'tagNumber', label: 'Tag ID', render: (val, row) => (
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center border border-green-500/20">
          <Beef size={14} className="text-green-400" />
        </div>
        <div>
          <p className="font-medium text-white">{val}</p>
          <p className="text-xs text-slate-400">{row.name}</p>
        </div>
      </div>
    )},
    { key: 'breed', label: 'Breed' },
    { key: 'gender', label: 'Gender', render: (val) => <Badge variant={val === 'Female' ? 'purple' : 'blue'}>{val}</Badge> },
    { key: 'age', label: 'Age', render: (val) => formatAge(val) },
    { key: 'weight', label: 'Weight', render: (val) => formatWeight(val) },
    { key: 'status', label: 'Status', render: (val) => <StatusBadge status={val} /> },
    { key: 'actions', label: 'Actions', sortable: false, render: (_, row) => (
      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
        <button onClick={() => { setSelectedAnimal(row); setIsQRModalOpen(true) }} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white" title="QR Code">
          <QrCode size={16} />
        </button>
        <button onClick={() => {
          setEditingAnimal(row)
          setFormData({
            tagNumber: row.tagNumber,
            name: row.name || '',
            breed: row.breed,
            gender: row.gender,
            status: row.status,
            weight: row.weight || '',
            age: row.age || '',
            dob: row.dob || '',
            purchaseDate: row.purchaseDate || '',
            purchasePrice: row.purchasePrice || '',
            color: row.color || '',
            notes: row.notes || ''
          })
          setIsModalOpen(true)
        }} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white" title="Edit">
          <Edit2 size={16} />
        </button>
        <button onClick={() => { setSelectedAnimal(row); setIsDeleteOpen(true) }} className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400" title="Delete">
          <Trash2 size={16} />
        </button>
      </div>
    )}
  ]

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Animal Management</h1>
          <p className="text-slate-400 text-sm mt-1">Manage herd, track health, and generate QR tags.</p>
        </div>
        <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={16} />
          Add Animal
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-4 flex items-center justify-between">
          <div><p className="text-xs text-slate-400">Total Herd</p><p className="text-2xl font-display font-bold text-white">{stats.total}</p></div>
          <Beef size={24} className="text-green-400 opacity-80" />
        </div>
        <div className="glass-card p-4 flex items-center justify-between">
          <div><p className="text-xs text-slate-400">Milking Cows</p><p className="text-2xl font-display font-bold text-white">{stats.cows}</p></div>
          <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center"><span className="text-purple-400 text-sm">♀</span></div>
        </div>
        <div className="glass-card p-4 flex items-center justify-between">
          <div><p className="text-xs text-slate-400">Bulls</p><p className="text-2xl font-display font-bold text-white">{stats.bulls}</p></div>
          <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center"><span className="text-blue-400 text-sm">♂</span></div>
        </div>
        <div className="glass-card p-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors border-l-2 border-l-transparent hover:border-l-red-500" onClick={() => setIsSickModalOpen(true)}>
          <div><p className="text-xs text-slate-400">Sick</p><p className="text-2xl font-display font-bold text-white">{stats.sick}</p></div>
          <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center"><span className="text-red-400 text-sm">!</span></div>
        </div>
      </div>

      <div className="glass-card p-5">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="search-bar flex-1">
            <Search size={16} className="text-slate-400" />
            <input type="text" placeholder="Search by tag, name or breed..." className="bg-transparent border-none outline-none w-full text-white placeholder:text-slate-500" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <Filter size={16} className="text-slate-400" />
              <select className="bg-transparent border-none outline-none text-sm text-white" value={filters.status} onChange={e => setFilter('status', e.target.value)}>
                <option value="">All Statuses</option>
                <option value="Healthy">Healthy</option>
                <option value="Sick">Sick</option>
                <option value="Pregnant">Pregnant</option>
                <option value="Calf">Calf</option>
              </select>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <select className="bg-transparent border-none outline-none text-sm text-white" value={filters.gender} onChange={e => setFilter('gender', e.target.value)}>
                <option value="">All Genders</option>
                <option value="Female">Female</option>
                <option value="Male">Male</option>
              </select>
            </div>
          </div>
        </div>
        <DataTable columns={columns} data={filteredData} pageSize={15} />
      </div>

      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingAnimal(null); setFormData(initialForm) }} title={editingAnimal ? "Edit Animal Record" : "Add New Animal"}>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs font-medium text-slate-400 mb-1">Tag Number *</label><input required type="text" className="input-field" value={formData.tagNumber} onChange={e => setFormData({...formData, tagNumber: e.target.value})} placeholder="e.g. JBS-001" /></div>
            <div><label className="block text-xs font-medium text-slate-400 mb-1">Name</label><input type="text" className="input-field" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Bella" /></div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Breed</label>
              <select className="input-field" value={formData.breed} onChange={e => setFormData({...formData, breed: e.target.value})}>
                <option>Friesian</option><option>Ayrshire</option><option>Guernsey</option><option>Jersey</option><option>Boran</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Gender</label>
              <select className="input-field" value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value})}>
                <option>Female</option><option>Male</option>
              </select>
            </div>
            <div><label className="block text-xs font-medium text-slate-400 mb-1">Weight (kg)</label><input type="number" className="input-field" value={formData.weight} onChange={e => setFormData({...formData, weight: e.target.value})} /></div>
            <div><label className="block text-xs font-medium text-slate-400 mb-1">Age (months)</label><input type="number" className="input-field" value={formData.age} onChange={e => setFormData({...formData, age: e.target.value})} /></div>
            <div><label className="block text-xs font-medium text-slate-400 mb-1">Status</label>
              <select className="input-field" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                <option>Healthy</option><option>Sick</option><option>Pregnant</option><option>Calf</option>
              </select>
            </div>
            <div><label className="block text-xs font-medium text-slate-400 mb-1">Color</label><input type="text" className="input-field" value={formData.color} onChange={e => setFormData({...formData, color: e.target.value})} /></div>
          </div>
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <button type="button" className="btn-secondary" onClick={() => { setIsModalOpen(false); setEditingAnimal(null); setFormData(initialForm) }}>Cancel</button>
            <button type="submit" className="btn-primary">Save Animal</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isQRModalOpen} onClose={() => setIsQRModalOpen(false)} title={`QR Tag: ${selectedAnimal?.tagNumber}`} size="sm">
        {selectedAnimal && (
          <div className="flex flex-col items-center py-6">
            <div className="bg-white p-4 rounded-2xl mb-6">
              <QRCodeSVG value={`jbs-farm://animal/${selectedAnimal.id}`} size={200} level="Q" imageSettings={{ src: '/vite.svg', x: undefined, y: undefined, height: 24, width: 24, excavate: true }} />
            </div>
            <h3 className="font-display font-bold text-2xl text-white">{selectedAnimal.tagNumber}</h3>
            <p className="text-slate-400">{selectedAnimal.name} • {selectedAnimal.breed}</p>
            <div className="mt-8 flex gap-3 w-full">
              <button className="btn-secondary flex-1 justify-center" onClick={() => setIsQRModalOpen(false)}>Close</button>
              <button className="btn-primary flex-1 justify-center">Print Label</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={isSickModalOpen} onClose={() => setIsSickModalOpen(false)} title="Manage Sick Animals">
        <div className="space-y-4">
          <div className="bg-white/5 p-4 rounded-xl border border-white/10 flex gap-2 items-end">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-400 mb-1">Mark Animal as Sick</label>
              <select className="input-field" onChange={(e) => {
                if(e.target.value) {
                  updateAnimal(e.target.value, { status: 'Sick' });
                  e.target.value = '';
                }
              }}>
                <option value="">Select a healthy animal...</option>
                {animals.filter(a => a.status !== 'Sick').map(a => (
                  <option key={a.id} value={a.id}>{a.tagNumber} ({a.name || 'Unnamed'})</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
            {animals.filter(a => a.status === 'Sick').length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-4">No sick animals currently.</p>
            ) : (
              animals.filter(a => a.status === 'Sick').map(a => (
                <div key={a.id} className="flex items-center justify-between bg-white/5 p-3 rounded-lg border border-red-500/20">
                  <div>
                    <p className="text-white font-medium">{a.tagNumber}</p>
                    <p className="text-xs text-slate-400">{a.name || 'Unnamed'}</p>
                  </div>
                  <button 
                    onClick={() => updateAnimal(a.id, { status: 'Healthy' })}
                    className="px-3 py-1.5 bg-green-500/20 text-green-400 rounded-lg text-sm hover:bg-green-500/30 transition-colors"
                  >
                    Mark Healthy
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </Modal>

      <ConfirmDialog isOpen={isDeleteOpen} onClose={() => setIsDeleteOpen(false)} onConfirm={() => { if(selectedAnimal) deleteAnimal(selectedAnimal.id) }} title="Delete Animal Record?" message={`Are you sure you want to permanently delete the record for ${selectedAnimal?.tagNumber}?`} />
    </div>
  )
}
