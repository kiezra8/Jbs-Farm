import { useEffect, useState } from 'react'
import { Plus, Search, Filter, QrCode, Edit2, Trash2, Beef, Check } from 'lucide-react'
import { useAnimalStore } from '../../store/useAnimalStore'
import DataTable from '../../components/ui/DataTable'
import { StatusBadge, Badge } from '../../components/ui/Badge'
import { formatAge, formatWeight } from '../../utils/formatters'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { QRCodeSVG } from 'qrcode.react'

const AGE_CATEGORIES = ['Heifer', 'Bullock', 'Bull', 'Cow']
const STATUS_OPTIONS = [
  { key: 'Healthy', label: 'Healthy', desc: 'Active & normal health', color: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' },
  { key: 'Sick', label: 'Sick', desc: 'Needs medical attention', color: 'border-rose-500/40 bg-rose-500/10 text-rose-300' },
  { key: 'Pregnant', label: 'Pregnant', desc: 'Confirmed gestation', color: 'border-purple-500/40 bg-purple-500/10 text-purple-300' },
  { key: 'Dry', label: 'Dry', desc: 'Resting non-lactating period', color: 'border-amber-500/40 bg-amber-500/10 text-amber-300' }
]

export default function Animals() {
  const { animals, loadAnimals, getFilteredAnimals, getStats, setSearchQuery, searchQuery, filters, setFilter, deleteAnimal, addAnimal, updateAnimal } = useAnimalStore()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isQRModalOpen, setIsQRModalOpen] = useState(false)
  const [selectedAnimal, setSelectedAnimal] = useState(null)
  const [editingAnimal, setEditingAnimal] = useState(null)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isSickModalOpen, setIsSickModalOpen] = useState(false)

  const initialForm = {
    tagNumber: '', name: '', breed: 'Friesian', gender: 'Female', status: ['Healthy'], hasCalf: false, weight: '', age: 'Cow', dob: '', purchaseDate: '', purchasePrice: '', color: '', notes: ''
  }

  // Form State
  const [formData, setFormData] = useState(initialForm)

  useEffect(() => { loadAnimals() }, [])

  const filteredData = getFilteredAnimals()
  const stats = getStats()

  const handleOpenEdit = (animal) => {
    setEditingAnimal(animal)
    let parsedStatuses = ['Healthy']
    if (Array.isArray(animal.status)) {
      parsedStatuses = animal.status.filter(s => s !== 'Calf')
    } else if (typeof animal.status === 'string') {
      parsedStatuses = animal.status.split(',').map(s => s.trim()).filter(s => Boolean(s) && s !== 'Calf')
    }
    if (parsedStatuses.length === 0) parsedStatuses = ['Healthy']

    let parsedAge = animal.age
    if (!AGE_CATEGORIES.includes(parsedAge)) {
      parsedAge = animal.gender === 'Male' ? 'Bull' : 'Cow'
    }

    setFormData({
      tagNumber: animal.tagNumber || '',
      name: animal.name || '',
      breed: animal.breed || 'Friesian',
      gender: animal.gender || 'Female',
      status: parsedStatuses,
      hasCalf: Boolean(animal.hasCalf),
      weight: animal.weight || '',
      age: parsedAge,
      dob: animal.dob || '',
      purchaseDate: animal.purchaseDate || '',
      purchasePrice: animal.purchasePrice || '',
      color: animal.color || '',
      notes: animal.notes || ''
    })
    setIsModalOpen(true)
  }

  const toggleStatus = (statusKey) => {
    const current = Array.isArray(formData.status) ? formData.status : [formData.status].filter(Boolean)
    let updated
    if (current.includes(statusKey)) {
      updated = current.filter(s => s !== statusKey)
      if (updated.length === 0) updated = ['Healthy']
    } else {
      updated = [...current, statusKey]
    }
    setFormData({ ...formData, status: updated })
  }

  const handleSave = async (e) => {
    e.preventDefault()
    try {
      const payload = {
        ...formData,
        name: formData.name.trim(),
        hasCalf: formData.gender === 'Male' ? false : Boolean(formData.hasCalf),
        weight: Number(formData.weight) || 0,
        age: formData.age || (formData.gender === 'Male' ? 'Bull' : 'Cow'),
        status: Array.isArray(formData.status) && formData.status.length > 0 ? formData.status : ['Healthy'],
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
    { key: 'tagNumber', label: 'Tag ID & Name', render: (val, row) => (
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center border border-green-500/20 flex-shrink-0">
          <Beef size={14} className="text-green-400" />
        </div>
        <div>
          <p className="font-semibold text-white">{val}</p>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-emerald-400 font-medium">{row.name || 'Unnamed'}</span>
            {row.gender !== 'Male' && row.hasCalf && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                🍼 Calf
              </span>
            )}
          </div>
        </div>
      </div>
    )},
    { key: 'breed', label: 'Breed' },
    { key: 'gender', label: 'Gender', render: (val) => <Badge variant={val === 'Female' ? 'purple' : 'blue'}>{val}</Badge> },
    { key: 'age', label: 'Age Category', render: (val) => <span className="font-medium text-slate-200">{formatAge(val)}</span> },
    { key: 'hasCalf', label: 'Calf Status', render: (val, row) => {
      if (row.gender === 'Male') return <span className="text-slate-500 text-xs">—</span>
      return val ? (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 border border-emerald-500/35 text-emerald-300">
          🍼 With Calf
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/5 border border-white/10 text-slate-400">
          No Calf
        </span>
      )
    }},
    { key: 'weight', label: 'Weight', render: (val) => formatWeight(val) },
    { key: 'status', label: 'Status', render: (val) => <StatusBadge status={val} /> },
    { key: 'actions', label: 'Actions', sortable: false, render: (_, row) => (
      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
        <button onClick={() => { setSelectedAnimal(row); setIsQRModalOpen(true) }} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white" title="QR Code">
          <QrCode size={16} />
        </button>
        <button onClick={() => handleOpenEdit(row)} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white" title="Edit">
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
          <p className="text-slate-400 text-sm mt-1">Manage herd, edit names, update status, and tap any row to edit.</p>
        </div>
        <button className="btn-primary" onClick={() => { setEditingAnimal(null); setFormData(initialForm); setIsModalOpen(true) }}>
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
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <div className="search-bar flex-1">
            <Search size={16} className="text-slate-400" />
            <input type="text" placeholder="Search by tag, name, breed, or age (e.g. Heifer)..." className="bg-transparent border-none outline-none w-full text-white placeholder:text-slate-500" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <Filter size={16} className="text-slate-400" />
              <select className="bg-transparent border-none outline-none text-sm text-white" value={filters.status} onChange={e => setFilter('status', e.target.value)}>
                <option value="">All Statuses</option>
                <option value="Healthy">Healthy</option>
                <option value="Sick">Sick</option>
                <option value="Pregnant">Pregnant</option>
                <option value="Dry">Dry</option>
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
        
        <div className="flex items-center justify-between mb-3 text-xs text-slate-400">
          <span>Showing {filteredData.length} cattle</span>
          <span className="text-emerald-400/90 font-medium">👉 Tip: Click or tap any row to edit</span>
        </div>

        <DataTable columns={columns} data={filteredData} pageSize={15} onRowClick={handleOpenEdit} />
      </div>

      {/* Add / Edit Animal Modal */}
      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingAnimal(null); setFormData(initialForm) }} title={editingAnimal ? `Edit Animal: ${formData.tagNumber}` : "Add New Animal"}>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Tag Number *</label>
              <input required type="text" className="input-field font-semibold" value={formData.tagNumber} onChange={e => setFormData({...formData, tagNumber: e.target.value})} placeholder="e.g. JBS-001" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Cow Name</label>
              <input type="text" className="input-field text-emerald-300 font-medium" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Bella" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Breed</label>
              <select className="input-field" value={formData.breed} onChange={e => setFormData({...formData, breed: e.target.value})}>
                <option>Friesian</option><option>Ayrshire</option><option>Guernsey</option><option>Jersey</option><option>Boran</option><option>Sahiwal</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Gender</label>
              <select className="input-field" value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value})}>
                <option>Female</option><option>Male</option>
              </select>
            </div>

            {/* Age Category */}
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Age Category *</label>
              <div className="grid grid-cols-4 gap-2">
                {AGE_CATEGORIES.map(cat => {
                  const isSelected = formData.age === cat
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setFormData({ ...formData, age: cat })}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all text-center ${
                        isSelected 
                          ? 'bg-emerald-500/25 border-emerald-500 text-emerald-300 shadow-sm shadow-emerald-500/20 font-bold' 
                          : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {cat}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Calf Status (Does cow have a calf?) */}
            {formData.gender !== 'Male' && (
              <div className="col-span-2 bg-white/5 p-3 rounded-xl border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-slate-300">Calf Status (Does this cow have a calf?)</label>
                  <span className="text-[11px] text-slate-400 font-medium">
                    {formData.hasCalf ? '🍼 Nursing calf attached' : 'No calf'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, hasCalf: false })}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all text-center ${
                      !formData.hasCalf
                        ? 'bg-slate-700/80 border-slate-500 text-white shadow-sm font-bold'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    No Calf
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, hasCalf: true })}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all text-center flex items-center justify-center gap-1.5 ${
                      formData.hasCalf
                        ? 'bg-emerald-500/25 border-emerald-500 text-emerald-300 shadow-sm shadow-emerald-500/20 font-bold'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span>🍼</span>
                    <span>With Calf</span>
                  </button>
                </div>
              </div>
            )}

            {/* Status (Multi-Selectable Checkboxes) */}
            <div className="col-span-2">
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-slate-400">Animal Status (Tap boxes to select multiple)</label>
                <span className="text-[11px] text-slate-500">e.g. Pregnant &amp; Sick, or Pregnant &amp; Healthy</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {STATUS_OPTIONS.map(opt => {
                  const currentStatuses = Array.isArray(formData.status) ? formData.status : [formData.status].filter(Boolean)
                  const isChecked = currentStatuses.includes(opt.key)
                  return (
                    <div
                      key={opt.key}
                      onClick={() => toggleStatus(opt.key)}
                      className={`p-3 rounded-xl border cursor-pointer select-none transition-all flex flex-col justify-between ${
                        isChecked 
                          ? `${opt.color} shadow-md` 
                          : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs">{opt.label}</span>
                        <div className={`w-4 h-4 rounded flex items-center justify-center border ${isChecked ? 'bg-emerald-500 border-emerald-400 text-white' : 'border-slate-500'}`}>
                          {isChecked && <Check size={12} strokeWidth={3} />}
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-400 leading-tight">{opt.desc}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Weight (kg)</label>
              <input type="number" className="input-field" value={formData.weight} onChange={e => setFormData({...formData, weight: e.target.value})} placeholder="e.g. 450" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Color / Marking</label>
              <input type="text" className="input-field" value={formData.color} onChange={e => setFormData({...formData, color: e.target.value})} placeholder="e.g. Black & White" />
            </div>
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
            <p className="text-slate-400">{selectedAnimal.name || 'Unnamed'} • {selectedAnimal.breed}</p>
            {selectedAnimal.gender !== 'Male' && (
              <div className="mt-3">
                {selectedAnimal.hasCalf ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">
                    🍼 With Calf
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-white/10 border border-white/20 text-slate-300">
                    No Calf
                  </span>
                )}
              </div>
            )}
            <div className="mt-8 flex gap-3 w-full">
              <button className="btn-secondary flex-1 justify-center" onClick={() => setIsQRModalOpen(false)}>Close</button>
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
                  const a = animals.find(item => item.id === e.target.value)
                  const prevStatus = Array.isArray(a?.status) ? a.status : [a?.status].filter(Boolean)
                  const newStatus = prevStatus.includes('Sick') ? prevStatus : [...prevStatus, 'Sick']
                  updateAnimal(e.target.value, { status: newStatus });
                  e.target.value = '';
                }
              }}>
                <option value="">Select an animal to mark sick...</option>
                {animals.filter(a => {
                  const s = Array.isArray(a.status) ? a.status : [a.status]
                  return !s.includes('Sick')
                }).map(a => (
                  <option key={a.id} value={a.id}>{a.tagNumber} ({a.name || 'Unnamed'})</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
            {animals.filter(a => {
              const s = Array.isArray(a.status) ? a.status : [a.status]
              return s.includes('Sick')
            }).length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-4">No sick animals currently.</p>
            ) : (
              animals.filter(a => {
                const s = Array.isArray(a.status) ? a.status : [a.status]
                return s.includes('Sick')
              }).map(a => (
                <div key={a.id} className="flex items-center justify-between bg-white/5 p-3 rounded-lg border border-red-500/20">
                  <div>
                    <p className="text-white font-medium">{a.tagNumber}</p>
                    <p className="text-xs text-slate-400">{a.name || 'Unnamed'}</p>
                  </div>
                  <button 
                    onClick={() => {
                      const prevStatus = Array.isArray(a.status) ? a.status : [a.status].filter(Boolean)
                      const newStatus = prevStatus.filter(s => s !== 'Sick')
                      updateAnimal(a.id, { status: newStatus.length > 0 ? newStatus : ['Healthy'] })
                    }}
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

      <ConfirmDialog isOpen={isDeleteOpen} onClose={() => setIsDeleteOpen(false)} onConfirm={() => { if(selectedAnimal) deleteAnimal(selectedAnimal.id) }} title="Delete Animal Record?" message={`Are you sure you want to permanently delete the record for ${selectedAnimal?.tagNumber} (${selectedAnimal?.name || 'Unnamed'})? All past milk records will remain safe and intact.`} />
    </div>
  )
}
