import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Search, Filter, QrCode, Edit2, Trash2, Beef } from 'lucide-react'
import { useAnimalStore } from '../../store/useAnimalStore'
import DataTable from '../../components/ui/DataTable'
import { StatusBadge, Badge } from '../../components/ui/Badge'
import { formatAge, formatWeight } from '../../utils/formatters'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { QRCodeSVG } from 'qrcode.react'

export default function Animals() {
  const { loadAnimals, getFilteredAnimals, getStats, setSearchQuery, searchQuery, filters, setFilter, deleteAnimal } = useAnimalStore()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isQRModalOpen, setIsQRModalOpen] = useState(false)
  const [selectedAnimal, setSelectedAnimal] = useState(null)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)

  useEffect(() => {
    loadAnimals()
  }, [])

  const filteredData = getFilteredAnimals()
  const stats = getStats()

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
        <button className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white" title="Edit">
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

      {/* Stats row */}
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
        <div className="glass-card p-4 flex items-center justify-between">
          <div><p className="text-xs text-slate-400">Sick</p><p className="text-2xl font-display font-bold text-white">{stats.sick}</p></div>
          <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center"><span className="text-red-400 text-sm">!</span></div>
        </div>
      </div>

      {/* Filters & Table */}
      <div className="glass-card p-5">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="search-bar flex-1">
            <Search size={16} className="text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by tag, name or breed..." 
              className="bg-transparent border-none outline-none w-full text-white placeholder:text-slate-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
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

      {/* Add Modal Placeholder */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add New Animal">
        <p className="text-slate-400 text-center py-8">Form component goes here.</p>
        <div className="flex justify-end gap-3 mt-4">
          <button className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
          <button className="btn-primary" onClick={() => setIsModalOpen(false)}>Save Record</button>
        </div>
      </Modal>

      {/* QR Modal */}
      <Modal isOpen={isQRModalOpen} onClose={() => setIsQRModalOpen(false)} title={`QR Tag: ${selectedAnimal?.tagNumber}`} size="sm">
        {selectedAnimal && (
          <div className="flex flex-col items-center py-6">
            <div className="bg-white p-4 rounded-2xl mb-6">
              <QRCodeSVG 
                value={`jbs-farm://animal/${selectedAnimal.id}`} 
                size={200} 
                level="Q"
                imageSettings={{ src: '/vite.svg', x: undefined, y: undefined, height: 24, width: 24, excavate: true }}
              />
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

      {/* Delete Dialog */}
      <ConfirmDialog 
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={() => { if(selectedAnimal) deleteAnimal(selectedAnimal.id) }}
        title="Delete Animal Record?"
        message={`Are you sure you want to permanently delete the record for ${selectedAnimal?.tagNumber}? This action cannot be undone and will remove all associated health and milk records.`}
      />
    </div>
  )
}
