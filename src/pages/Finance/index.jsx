import { useEffect } from 'react'
import { Plus } from 'lucide-react'
import { useFinanceStore } from '../../store/useFinanceStore'
import DataTable from '../../components/ui/DataTable'
import { Badge } from '../../components/ui/Badge'
import { formatKES } from '../../utils/formatters'
import { format } from 'date-fns'

export default function Finance() {
  const { transactions, loadTransactions, getTotalStats, getMonthlyStats } = useFinanceStore()

  useEffect(() => {
    loadTransactions()
  }, [])

  const monthStats = getMonthlyStats()
  const totalStats = getTotalStats()

  const columns = [
    { key: 'date', label: 'Date', render: (val) => format(new Date(val), 'dd MMM yyyy') },
    { key: 'category', label: 'Category', render: (val) => <span className="font-medium text-white">{val}</span> },
    { key: 'type', label: 'Type', render: (val) => <Badge variant={val === 'Income' ? 'green' : 'red'}>{val}</Badge> },
    { key: 'amount', label: 'Amount', render: (val, row) => (
      <span className={row.type === 'Income' ? 'text-green-400' : 'text-red-400'}>
        {row.type === 'Income' ? '+' : '-'}{formatKES(val)}
      </span>
    )},
    { key: 'description', label: 'Description', render: (val) => val || '—' },
    { key: 'reference', label: 'Ref', render: (val) => val || '—' },
  ]

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Financial Management</h1>
          <p className="text-slate-400 text-sm mt-1">Track income, expenses, and farm profitability.</p>
        </div>
        <button className="btn-primary"><Plus size={16} /> Add Transaction</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-5 border-l-4 border-l-green-500">
          <p className="text-sm text-slate-400 mb-1">Monthly Income</p>
          <p className="text-3xl font-display font-bold text-white">{formatKES(monthStats.income)}</p>
        </div>
        <div className="glass-card p-5 border-l-4 border-l-red-500">
          <p className="text-sm text-slate-400 mb-1">Monthly Expenses</p>
          <p className="text-3xl font-display font-bold text-white">{formatKES(monthStats.expenses)}</p>
        </div>
        <div className="glass-card p-5 border-l-4 border-l-blue-500">
          <p className="text-sm text-slate-400 mb-1">Net Profit (Month)</p>
          <p className={`text-3xl font-display font-bold ${monthStats.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatKES(monthStats.profit)}
          </p>
        </div>
      </div>

      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold text-white">Transaction Ledger</h3>
          <button className="btn-secondary text-xs py-1.5 px-3">Export to Excel</button>
        </div>
        <DataTable columns={columns} data={transactions} pageSize={12} />
      </div>
    </div>
  )
}
