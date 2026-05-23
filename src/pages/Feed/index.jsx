import { useEffect } from 'react'
import { Plus } from 'lucide-react'
import { useFeedStore } from '../../store/useFeedStore'
import DataTable from '../../components/ui/DataTable'
import { Badge } from '../../components/ui/Badge'
import { formatKES } from '../../utils/formatters'
import { format } from 'date-fns'

export default function Feed() {
  const { inventory, transactions, loadAll, getStats } = useFeedStore()

  useEffect(() => {
    loadAll()
  }, [])

  const stats = getStats()

  const inventoryCols = [
    { key: 'feedType', label: 'Feed Type', render: (val) => <span className="font-medium text-white">{val}</span> },
    { key: 'currentStock', label: 'Current Stock', render: (val, row) => (
      <div className="flex items-center gap-3">
        <div className="flex-1 max-w-[100px]">
          <div className="h-2 w-full bg-slate-700 rounded-full overflow-hidden">
            <div 
              className={`h-full ${val <= row.minStock ? 'bg-red-500' : 'bg-green-500'}`} 
              style={{ width: `${Math.min((val / (row.minStock * 4)) * 100, 100)}%` }} 
            />
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
    { key: 'supplier', label: 'Supplier/Notes', render: (val, row) => val || row.notes || '—' },
  ]

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Feed & Nutrition</h1>
          <p className="text-slate-400 text-sm mt-1">Manage inventory, purchases, and consumption logs.</p>
        </div>
        <div className="flex gap-3">
          <button className="btn-secondary"><Plus size={16} /> Log Consumption</button>
          <button className="btn-primary"><Plus size={16} /> Purchase Feed</button>
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
    </div>
  )
}
