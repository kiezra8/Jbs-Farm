import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { useFinanceStore } from '../../store/useFinanceStore'
import DataTable from '../../components/ui/DataTable'
import { Badge } from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import PinGuard from '../../components/ui/PinGuard'
import { formatUGX } from '../../utils/formatters'
import { format } from 'date-fns'

export default function Finance() {
  const { transactions, loadTransactions, getTotalStats, getMonthlyStats, getDailyStats, addTransaction } = useFinanceStore()
  const [isModalOpen, setIsModalOpen] = useState(false)

  const [formData, setFormData] = useState({ date: format(new Date(), 'yyyy-MM-dd'), type: 'Expense', category: '', amount: '', description: '', reference: '' })

  useEffect(() => { loadTransactions() }, [])

  const monthStats = getMonthlyStats()
  const dailyStats = getDailyStats()

  const handleSave = async (e) => {
    e.preventDefault()
    await addTransaction({ ...formData, amount: Number(formData.amount) || 0 })
    setIsModalOpen(false)
    setFormData({ date: format(new Date(), 'yyyy-MM-dd'), type: 'Expense', category: '', amount: '', description: '', reference: '' })
  }

  const columns = [
    { key: 'date', label: 'Date', render: (val) => format(new Date(val), 'dd MMM yyyy') },
    { key: 'category', label: 'Category', render: (val) => <span className="font-medium text-white">{val}</span> },
    { key: 'type', label: 'Type', render: (val) => <Badge variant={val === 'Income' ? 'green' : 'red'}>{val}</Badge> },
    { key: 'amount', label: 'Amount', render: (val, row) => (
      <span className={row.type === 'Income' ? 'text-green-400' : 'text-red-400'}>{row.type === 'Income' ? '+' : '-'}{formatUGX(val)}</span>
    )},
    { key: 'description', label: 'Description', render: (val) => val || '—' },
    { key: 'reference', label: 'Ref', render: (val) => val || '—' },
  ]

  const categories = formData.type === 'Income' 
    ? ['Milk Sales', 'Animal Sales', 'Breeding Fees', 'Government Subsidy', 'Other Income']
    : ['Feed', 'Veterinary', 'Salaries', 'Equipment', 'Utilities', 'Transport', 'Maintenance', 'Other Expense']

  return (
    <PinGuard>
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Financial Management</h1>
          <p className="text-slate-400 text-sm mt-1">Track income, expenses, and farm profitability.</p>
        </div>
        <button className="btn-primary" onClick={() => setIsModalOpen(true)}><Plus size={16} /> Add Transaction</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-card p-5 border-l-4 border-l-green-500">
          <p className="text-sm text-slate-400 mb-1">Daily Revenue</p>
          <p className="text-3xl font-display font-bold text-white">{formatUGX(dailyStats.income)}</p>
        </div>
        <div className="glass-card p-5 border-l-4 border-l-green-500">
          <p className="text-sm text-slate-400 mb-1">Monthly Income</p>
          <p className="text-3xl font-display font-bold text-white">{formatUGX(monthStats.income)}</p>
        </div>
        <div className="glass-card p-5 border-l-4 border-l-red-500">
          <p className="text-sm text-slate-400 mb-1">Monthly Expenses</p>
          <p className="text-3xl font-display font-bold text-white">{formatUGX(monthStats.expenses)}</p>
        </div>
        <div className="glass-card p-5 border-l-4 border-l-blue-500">
          <p className="text-sm text-slate-400 mb-1">Net Profit (Month)</p>
          <p className={`text-3xl font-display font-bold ${monthStats.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatUGX(monthStats.profit)}</p>
        </div>
      </div>

      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold text-white">Transaction Ledger</h3>
          <button className="btn-secondary text-xs py-1.5 px-3">Export to Excel</button>
        </div>
        <DataTable columns={columns} data={transactions} pageSize={12} />
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Financial Transaction">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Transaction Type *</label>
              <select required className="input-field" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value, category: ''})}>
                <option>Expense</option><option>Income</option>
              </select>
            </div>
            <div><label className="block text-xs font-medium text-slate-400 mb-1">Date *</label><input required type="date" className="input-field" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} /></div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Category *</label>
              <select required className="input-field" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                <option value="">Select Category...</option>
                {categories.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div><label className="block text-xs font-medium text-slate-400 mb-1">Amount (Ushs) *</label><input required type="number" className="input-field" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} /></div>
            <div className="col-span-2"><label className="block text-xs font-medium text-slate-400 mb-1">Description *</label><input required type="text" className="input-field" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="e.g. Bought 10 bags of Dairy Meal" /></div>
            <div className="col-span-2"><label className="block text-xs font-medium text-slate-400 mb-1">Reference / Receipt Number</label><input type="text" className="input-field" value={formData.reference} onChange={e => setFormData({...formData, reference: e.target.value})} /></div>
          </div>
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary">Save Transaction</button>
          </div>
        </form>
      </Modal>
    </div>
    </PinGuard>
  )
}
