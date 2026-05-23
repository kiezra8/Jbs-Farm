import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { useFeedStore } from '../../store/useFeedStore'
import DataTable from '../../components/ui/DataTable'
import { Badge } from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import { formatKES } from '../../utils/formatters'
import { format } from 'date-fns'

export default function Feed() {
  const { inventory, transactions, loadAll, getStats, addTransaction } = useFeedStore()
  const [isLogOpen, setIsLogOpen] = useState(false)
  const [isPurchaseOpen, setIsPurchaseOpen] = useState(false)

  const [logData, setLogData] = useState({ feedType: '', quantity: '', date: format(new Date(), 'yyyy-MM-dd'), notes: '' })
  const [purchaseData, setPurchaseData] = useState({ feedType: '', quantity: '', totalCost: '', supplier: '', date: format(new Date(), 'yyyy-MM-dd'), notes: '' })

  useEffect(() => { loadAll() }, [])

  const stats = getStats()

  const handleLogSave = async (e) => {
    e.preventDefault()
    const feed = inventory.find(i => i.feedType === logData.feedType)
    if (!feed) return
    await addTransaction({ ...logData, type: 'Consumption', quantity: Number(logData.quantity) || 0, unit: feed.unit, totalCost: 0 })
    setIsLogOpen(false)
    setLogData({ feedType: '', quantity: '', date: format(new Date(), 'yyyy-MM-dd'), notes: '' })
  }

  const handlePurchaseSave = async (e) => {
    e.preventDefault()
    const feed = inventory.find(i => i.feedType === purchaseData.feedType)
    if (!feed) return
    await addTransaction({ ...purchaseData, type: 'Purchase', quantity: Number(purchaseData.quantity) || 0, totalCost: Number(purchaseData.totalCost) || 0, unit: feed.unit })
    setIsPurchaseOpen(false)
    setPurchaseData({ feedType: '', quantity: '', totalCost: '', supplier: '', date: format(new Date(), 'yyyy-MM-dd'), notes: '' })
  }

  const inventoryCols = [
    { key: 'feedType', label: 'Feed Type', render: (val) => <span className="font-medium text-white">{val}</span> },
    { key: 'currentStock', label: 'Current Stock', render: (val, row) => (
      <div className="flex items-center gap-3">
        <div className="flex-1 max-w-[100px]">
          <div className="h-2 w-full bg-slate-700 rounded-full overflow-hidden">
            <div className={`h-full ${val <= row.minStock ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${Math.min((val / (row.minStock * 4)) * 100, 100)}%` }} />
          </div>
        </div>
        <span className={val <= row.minStock ? 'text-red-400 font-medium' : ''}>{val} {row.unit}</span>
      </div>
    )},
    { key: 'minStock', label: 'Min. Threshold', render: (val, row) => `${val} ${row.unit}` },
    { key: 'unitCost', label: 'Unit Cost', render: (val) => formatKES(val) },
  ]

  const transactionCols = [
    { key: 'date', label: 'Date', render: (val) => format(new Date(val), 'dd MMM yyyy') },
    { key: 'feedType', label: 'Feed Type' },
    { key: 'type', label: 'Transaction', render: (val) => <Badge variant={val === 'Purchase' ? 'green' : 'amber'}>{val}</Badge> },
    { key: 'quantity', label: 'Quantity', render: (val, row) => `${val} ${row.unit}` },
    { key: 'totalCost', label: 'Total Cost', render: (val) => val > 0 ? formatKES(val) : '—' },
  ]

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Feed & Nutrition</h1>
          <p className="text-slate-400 text-sm mt-1">Manage inventory, purchases, and consumption logs.</p>
        </div>
        <div className="flex gap-3">
          <button className="btn-secondary" onClick={() => setIsLogOpen(true)}><Plus size={16} /> Log Consumption</button>
          <button className="btn-primary" onClick={() => setIsPurchaseOpen(true)}><Plus size={16} /> Purchase Feed</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-4 flex items-center justify-between border-l-2 border-l-amber-500">
          <div><p className="text-xs text-slate-400">Total Inventory Value</p><p className="text-2xl font-display font-bold text-white">{formatKES(stats.totalValue)}</p></div>
        </div>
        <div className="glass-card p-4 flex items-center justify-between border-l-2 border-l-green-500">
          <div><p className="text-xs text-slate-400">Monthly Purchases</p><p className="text-2xl font-display font-bold text-white">{formatKES(stats.monthPurchases)}</p></div>
        </div>
        <div className="glass-card p-4 flex items-center justify-between border-l-2 border-l-red-500">
          <div><p className="text-xs text-slate-400">Low Stock Alerts</p><p className="text-2xl font-display font-bold text-white">{stats.lowStockCount}</p></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-5">
          <h3 className="font-display font-semibold text-white mb-4">Current Inventory</h3>
          <DataTable columns={inventoryCols} data={inventory} pageSize={6} />
        </div>
        <div className="glass-card p-5">
          <h3 className="font-display font-semibold text-white mb-4">Recent Transactions</h3>
          <DataTable columns={transactionCols} data={transactions} pageSize={6} />
        </div>
      </div>

      <Modal isOpen={isLogOpen} onClose={() => setIsLogOpen(false)} title="Log Feed Consumption">
        <form onSubmit={handleLogSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-400 mb-1">Feed Type *</label>
              <select required className="input-field" value={logData.feedType} onChange={e => setLogData({...logData, feedType: e.target.value})}>
                <option value="">Select Feed...</option>
                {inventory.map(f => <option key={f.id} value={f.feedType}>{f.feedType} (in {f.unit})</option>)}
              </select>
            </div>
            <div><label className="block text-xs font-medium text-slate-400 mb-1">Date *</label><input required type="date" className="input-field" value={logData.date} onChange={e => setLogData({...logData, date: e.target.value})} /></div>
            <div><label className="block text-xs font-medium text-slate-400 mb-1">Quantity Used *</label><input required type="number" className="input-field" value={logData.quantity} onChange={e => setLogData({...logData, quantity: e.target.value})} /></div>
            <div className="col-span-2"><label className="block text-xs font-medium text-slate-400 mb-1">Notes</label><input type="text" className="input-field" value={logData.notes} onChange={e => setLogData({...logData, notes: e.target.value})} /></div>
          </div>
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <button type="button" className="btn-secondary" onClick={() => setIsLogOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary">Log Consumption</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isPurchaseOpen} onClose={() => setIsPurchaseOpen(false)} title="Purchase Feed">
        <form onSubmit={handlePurchaseSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-400 mb-1">Feed Type *</label>
              <select required className="input-field" value={purchaseData.feedType} onChange={e => setPurchaseData({...purchaseData, feedType: e.target.value})}>
                <option value="">Select Feed...</option>
                {inventory.map(f => <option key={f.id} value={f.feedType}>{f.feedType} (in {f.unit})</option>)}
              </select>
            </div>
            <div><label className="block text-xs font-medium text-slate-400 mb-1">Quantity Bought *</label><input required type="number" className="input-field" value={purchaseData.quantity} onChange={e => setPurchaseData({...purchaseData, quantity: e.target.value})} /></div>
            <div><label className="block text-xs font-medium text-slate-400 mb-1">Total Cost (KES) *</label><input required type="number" className="input-field" value={purchaseData.totalCost} onChange={e => setPurchaseData({...purchaseData, totalCost: e.target.value})} /></div>
            <div><label className="block text-xs font-medium text-slate-400 mb-1">Date *</label><input required type="date" className="input-field" value={purchaseData.date} onChange={e => setPurchaseData({...purchaseData, date: e.target.value})} /></div>
            <div><label className="block text-xs font-medium text-slate-400 mb-1">Supplier</label><input type="text" className="input-field" value={purchaseData.supplier} onChange={e => setPurchaseData({...purchaseData, supplier: e.target.value})} /></div>
            <div className="col-span-2"><label className="block text-xs font-medium text-slate-400 mb-1">Notes</label><input type="text" className="input-field" value={purchaseData.notes} onChange={e => setPurchaseData({...purchaseData, notes: e.target.value})} /></div>
          </div>
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <button type="button" className="btn-secondary" onClick={() => setIsPurchaseOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary">Save Purchase</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
