import { useEffect, useState } from 'react'
import { Plus, Edit2, Trash2 } from 'lucide-react'
import { useMilkStore } from '../../store/useMilkStore'
import { useAnimalStore } from '../../store/useAnimalStore'
import DataTable from '../../components/ui/DataTable'
import { Badge } from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { formatLiters } from '../../utils/formatters'
import { format } from 'date-fns'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

export default function Milk() {
  const { records, loadRecords, getStats, getDailyTotals, addRecord, updateRecord, deleteRecord } = useMilkStore()
  const { animals, loadAnimals } = useAnimalStore()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState(null)
  const [selectedRecord, setSelectedRecord] = useState(null)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)

  const initialForm = { animalId: '', date: format(new Date(), 'yyyy-MM-dd'), session: 'Morning', amount: '', calvesAmount: '' }
  const [formData, setFormData] = useState(initialForm)

  useEffect(() => { loadRecords(); loadAnimals() }, [])

  const stats = getStats()
  const dailyTotals = getDailyTotals(7)
  const enhancedRecords = records.map(r => {
    const animal = animals.find(a => String(a.id) === String(r.animalId))
    return { ...r, animalName: animal?.name, tagNumber: animal?.tagNumber }
  })

  const handleSave = async (e) => {
    e.preventDefault()
    const payload = { ...formData, animalId: formData.animalId, amount: Number(formData.amount) || 0, calvesAmount: Number(formData.calvesAmount) || 0 }
    if (editingRecord) {
      await updateRecord(editingRecord.id, payload)
    } else {
      await addRecord(payload)
    }
    setIsModalOpen(false)
    setEditingRecord(null)
    setFormData(initialForm)
  }

  const columns = [
    { key: 'date', label: 'Date', render: (val) => format(new Date(val), 'dd MMM yyyy') },
    { key: 'tagNumber', label: 'Cow', render: (val, row) => (
      <div><p className="font-medium text-white">{val}</p><p className="text-xs text-slate-400">{row.animalName}</p></div>
    )},
    { key: 'session', label: 'Session', render: (val) => <Badge variant={val === 'Morning' ? 'blue' : val === 'Afternoon' ? 'amber' : 'purple'}>{val}</Badge> },
    { key: 'amount', label: 'Total (L)', render: (val) => formatLiters(val) },
    { key: 'calvesAmount', label: 'Calves (L)', render: (val) => formatLiters(val || 0) },
    { key: 'netAmount', label: 'Net (L)', render: (_, row) => formatLiters((row.amount || 0) - (row.calvesAmount || 0)) },
    { key: 'revenue', label: 'Revenue', render: (_, row) => new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX' }).format(((row.amount || 0) - (row.calvesAmount || 0)) * 1500) },
    { key: 'actions', label: 'Actions', sortable: false, render: (_, row) => (
      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
        <button onClick={() => {
          setEditingRecord(row)
          setFormData({
            animalId: row.animalId,
            date: row.date,
            session: row.session,
            amount: String(row.amount),
            calvesAmount: String(row.calvesAmount || '')
          })
          setIsModalOpen(true)
        }} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white" title="Edit">
          <Edit2 size={16} />
        </button>
        <button onClick={() => { setSelectedRecord(row); setIsDeleteOpen(true) }} className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400" title="Delete">
          <Trash2 size={16} />
        </button>
      </div>
    )}
  ]

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Milk Production</h1>
          <p className="text-slate-400 text-sm mt-1">Track daily milking sessions, calves consumption, and revenue.</p>
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-4 flex items-center justify-between border-l-2 border-l-rose-500">
          <div><p className="text-xs text-slate-400">Given to Calves Today</p><p className="text-2xl font-display font-bold text-white">{formatLiters(stats.todayCalves)}</p></div><span className="text-2xl opacity-80">🍼</span>
        </div>
        <div className="glass-card p-4 flex items-center justify-between border-l-2 border-l-teal-500">
          <div><p className="text-xs text-slate-400">Net Amount Today</p><p className="text-2xl font-display font-bold text-white">{formatLiters(stats.todayNet)}</p></div><span className="text-2xl opacity-80">📦</span>
        </div>
        <div className="glass-card p-4 flex items-center justify-between border-l-2 border-l-emerald-500">
          <div><p className="text-xs text-slate-400">Today's Revenue</p><p className="text-xl font-display font-bold text-white">{new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX' }).format(stats.todayRevenue)}</p></div><span className="text-2xl opacity-80">💰</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-5">
          <h3 className="text-sm font-medium text-slate-400 mb-4">Daily Milk Production (Liters)</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyTotals}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="label" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Legend />
                <Line type="monotone" dataKey="total" name="Total Extracted" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="net" name="Net Remained" stroke="#14b8a6" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card p-5">
          <h3 className="text-sm font-medium text-slate-400 mb-4">Milk Distribution (Liters)</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyTotals}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="label" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Legend />
                <Bar dataKey="calves" name="Given to Calves" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="net" name="Net Remained" fill="#14b8a6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="glass-card p-5">
        <DataTable columns={columns} data={enhancedRecords} pageSize={10} />
      </div>

      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingRecord(null); setFormData(initialForm) }} title={editingRecord ? "Edit Milk Yield" : "Add Milk Yield"}>
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
                <option>Morning</option><option>Afternoon</option><option>Evening</option>
              </select>
            </div>
            <div className="col-span-1"><label className="block text-xs font-medium text-slate-400 mb-1">Total Amount (Liters) *</label><input required type="number" step="0.1" className="input-field" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} /></div>
            <div className="col-span-1"><label className="block text-xs font-medium text-slate-400 mb-1">Given to Calves (L)</label><input type="number" step="0.1" className="input-field" value={formData.calvesAmount} onChange={e => setFormData({...formData, calvesAmount: e.target.value})} /></div>
          </div>
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <button type="button" className="btn-secondary" onClick={() => { setIsModalOpen(false); setEditingRecord(null); setFormData(initialForm) }}>Cancel</button>
            <button type="submit" className="btn-primary">Save Record</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={isDeleteOpen} onClose={() => setIsDeleteOpen(false)} onConfirm={() => { if(selectedRecord) deleteRecord(selectedRecord.id) }} title="Delete Milk Yield Record?" message={`Are you sure you want to permanently delete this milk yield record?`} />
    </div>
  )
}
