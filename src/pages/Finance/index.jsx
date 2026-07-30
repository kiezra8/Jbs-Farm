import { useEffect, useState } from 'react'
import { Plus, Edit2, Trash2, Printer } from 'lucide-react'
import { useFinanceStore } from '../../store/useFinanceStore'
import DataTable from '../../components/ui/DataTable'
import { Badge } from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import PinGuard from '../../components/ui/PinGuard'
import { formatUGX } from '../../utils/formatters'
import { format } from 'date-fns'
import * as XLSX from 'xlsx'
import { useRef } from 'react'

export default function Finance() {
  const { transactions, loadTransactions, getMonthlyStats, getDailyStats, addTransaction, updateTransaction, deleteTransaction } = useFinanceStore()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState(null)
  const [selectedTransaction, setSelectedTransaction] = useState(null)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)

  const initialForm = { date: format(new Date(), 'yyyy-MM-dd'), type: 'Expense', source: 'Bank', category: 'Feed', amount: '', description: '', reference: '' }
  const [formData, setFormData] = useState(initialForm)
  const excelInputRef = useRef(null)

  useEffect(() => { loadTransactions() }, [])

  const handleExpenseExcelImport = (e) => {
    const file = e.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result
        const wb = XLSX.read(bstr, { type: 'binary' })
        
        let importedCount = 0
        let isPettyCashFormat = false

        // Loop through all sheets in the workbook to capture all data
        for (const sheetName of wb.SheetNames) {
          const ws = wb.Sheets[sheetName]
          const rawRows = XLSX.utils.sheet_to_json(ws, { defval: '', header: 1 })
          
          if (rawRows.length === 0) continue

          // Detect format by looking for standard petty cash labels in first 10 rows
          let headerIndex = -1
          for (let idx = 0; idx < Math.min(10, rawRows.length); idx++) {
            const r = rawRows[idx]
            if (r && (r.includes('Particulars') || r.includes('Exepense Particulars') || r.includes('Recipeint') || r.includes('Client Name'))) {
              headerIndex = idx
              isPettyCashFormat = true
              break
            }
          }

          if (isPettyCashFormat) {
            // Dual column Cash Book parser
            const parseExcelDate = (val) => {
              if (!val) return null
              if (typeof val === 'number') {
                const date = new Date((val - 25569) * 86400 * 1000)
                try { return format(date, 'yyyy-MM-dd') } catch (_) { return null }
              }
              try {
                const parsed = new Date(val)
                if (!isNaN(parsed.getTime())) return format(parsed, 'yyyy-MM-dd')
              } catch (_) {}
              return null
            }
            const todayStr = format(new Date(), 'yyyy-MM-dd')

            for (let i = headerIndex + 1; i < rawRows.length; i++) {
              const row = rawRows[i]
              if (!row || row.length === 0) continue

              // 1. Receipts (Income)
              const rAmount = Number(row[5]) || 0
              const rClient = String(row[1] || '').trim()
              const rParticulars = String(row[2] || '').trim()
              const rLowerClient = rClient.toLowerCase()
              const rLowerPart = rParticulars.toLowerCase()

              const isBalBF = rLowerClient.includes('bal') || rLowerClient.includes('b/f') || rLowerPart.includes('bal') || rLowerPart.includes('b/f')

              if (rAmount > 0 && !isBalBF) {
                await addTransaction({
                  date: parseExcelDate(row[0]) || todayStr,
                  type: 'Income',
                  source: 'Petty Cash',
                  category: 'Petty Cash Receipt',
                  amount: rAmount,
                  description: `${rClient} - ${rParticulars}`.replace(/^[\s\-]+|[\s\-]+$/g, '') || 'Petty cash receipt',
                  reference: String(row[6] || '')
                })
                importedCount++
              }

              // 2. Payments (Expenses)
              const pAmount = Number(row[11]) || 0
              const pRecipient = String(row[9] || '').trim()
              const pParticulars = String(row[10] || '').trim()
              const pLowerRec = pRecipient.toLowerCase()
              const pLowerPart = pParticulars.toLowerCase()
              
              const isPBalBF = pLowerRec.includes('bal') || pLowerRec.includes('b/f') || pLowerPart.includes('bal') || pLowerPart.includes('b/f')

              if (pAmount > 0 && !isPBalBF) {
                const pSource = String(row[12] || '').toLowerCase() === 'bank' ? 'Bank' : 'Petty Cash'
                await addTransaction({
                  date: parseExcelDate(row[8]) || todayStr,
                  type: 'Expense',
                  source: pSource,
                  category: pParticulars || 'General Expense',
                  amount: pAmount,
                  description: `${pRecipient} - ${pParticulars}`.replace(/^[\s\-]+|[\s\-]+$/g, '') || 'Petty cash payment',
                  reference: String(row[12] || '')
                })
                importedCount++
              }
            }
          } else {
            // Fall back to standard flat format parser
            const flatData = XLSX.utils.sheet_to_json(ws)
            for (const row of flatData) {
              const amount = Number(row.Amount) || 0
              if (amount > 0) {
                await addTransaction({
                  date: row.Date || format(new Date(), 'yyyy-MM-dd'),
                  type: row.Type || 'Expense',
                  source: row['Payment Method'] === 'Bank' ? 'Bank' : 'Petty Cash',
                  category: row.Category || 'General Expense',
                  amount,
                  description: row.Description || 'Imported item',
                  reference: row.Reference || ''
                })
                importedCount++
              }
            }
          }
        }
        alert(`Successfully imported ${importedCount} transactions from Excel sheet(s)!`)
      } catch (err) {
        console.error('Import failed:', err)
        alert('Failed to parse excel file. Please make sure columns map correctly.')
      }
      e.target.value = null
    }
    reader.readAsBinaryString(file)
  }

  const monthStats = getMonthlyStats()
  const dailyStats = getDailyStats()

  const handleSave = async (e) => {
    e.preventDefault()
    const payload = { ...formData, amount: Number(formData.amount) || 0 }
    if (editingTransaction) {
      await updateTransaction(editingTransaction.id, payload)
    } else {
      await addTransaction(payload)
    }
    setIsModalOpen(false)
    setEditingTransaction(null)
    setFormData(initialForm)
  }

  const handlePrint = () => {
    window.print()
  }

  const columns = [
    { key: 'date', label: 'Date', render: (val) => format(new Date(val), 'dd MMM yyyy') },
    { key: 'category', label: 'Category', render: (val) => <span className="font-medium text-white">{val}</span> },
    { key: 'source', label: 'Source', render: (val) => <span className="text-slate-300">{val || 'Bank'}</span> },
    { key: 'type', label: 'Type', render: (val) => <Badge variant={val === 'Income' ? 'green' : 'red'}>{val}</Badge> },
    { key: 'amount', label: 'Amount', render: (val, row) => (
      <span className={row.type === 'Income' ? 'text-green-400' : 'text-red-400'}>
        {row.type === 'Income' ? '+' : '-'}{formatUGX(val)}
      </span>
    )},
    { key: 'description', label: 'Description', render: (val) => val || '—' },
    { key: 'reference', label: 'Ref', render: (val) => val || '—' },
    { key: 'actions', label: 'Actions', sortable: false, render: (_, row) => (
      <div className="flex items-center gap-2 print:hidden" onClick={e => e.stopPropagation()}>
        <button onClick={() => {
          setEditingTransaction(row)
          setFormData({
            date: row.date,
            type: row.type || 'Expense',
            source: row.source || 'Bank',
            category: row.category || 'Feed',
            amount: String(row.amount),
            description: row.description || '',
            reference: row.reference || ''
          })
          setIsModalOpen(true)
        }} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white" title="Edit">
          <Edit2 size={16} />
        </button>
        <button onClick={() => { setSelectedTransaction(row); setIsDeleteOpen(true) }} className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400" title="Delete">
          <Trash2 size={16} />
        </button>
      </div>
    )}
  ]

  const categoriesList = [
    'Feed',
    'Veterinary/Drugs',
    'Salaries',
    'Rent',
    'Security',
    'Member Withdraw Savings',
    'Transport',
    'Utilities',
    'Maintenance',
    'Bank Charges',
    'Other Expense'
  ]

  return (
    <PinGuard>
    <div className="space-y-6">
      <div className="page-header flex justify-between items-center">
        <div>
          <h1 className="page-title">Financial Management</h1>
          <p className="text-slate-400 text-sm mt-1">Track income, expenses, and farm profitability.</p>
        </div>
        <div className="flex gap-2 print:hidden">
          <button 
            onClick={handlePrint}
            className="btn-secondary flex items-center gap-2 text-slate-300 hover:text-white border-white/10 hover:bg-white/5"
            title="Print Ledger"
          >
            <Printer size={16} /> Print View
          </button>
          <input 
            type="file" 
            accept=".xlsx, .xls, .csv" 
            onChange={handleExpenseExcelImport} 
            ref={excelInputRef} 
            className="hidden" 
          />
          <button 
            onClick={() => excelInputRef.current.click()} 
            className="btn-secondary flex items-center gap-2"
          >
            <Edit2 size={16} /> Import Excel
          </button>
          <button className="btn-primary" onClick={() => setIsModalOpen(true)}><Plus size={16} /> Add Transaction</button>
        </div>
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
        </div>
        <DataTable columns={columns} data={transactions} pageSize={12} />
      </div>

      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingTransaction(null); setFormData(initialForm) }} title={editingTransaction ? "Edit Transaction" : "Add Financial Transaction"}>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Transaction Type *</label>
              <select required className="input-field" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                <option value="Expense">Expense (Outgoing)</option>
                <option value="Income">Income (Incoming)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Payment Source *</label>
              <select required className="input-field" value={formData.source} onChange={e => setFormData({...formData, source: e.target.value})}>
                <option value="Bank">Bank Account</option>
                <option value="Petty Cash">Petty Cash</option>
              </select>
            </div>
            <div><label className="block text-xs font-medium text-slate-400 mb-1">Date *</label><input required type="date" className="input-field" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} /></div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Category *</label>
              <select required className="input-field" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                {categoriesList.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div><label className="block text-xs font-medium text-slate-400 mb-1">Amount (Ushs) *</label><input required type="number" className="input-field" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} /></div>
            <div className="col-span-2"><label className="block text-xs font-medium text-slate-400 mb-1">Description *</label><input required type="text" className="input-field" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="e.g. Bought 10 bags of Dairy Meal" /></div>
            <div className="col-span-2"><label className="block text-xs font-medium text-slate-400 mb-1">Reference / Receipt Number</label><input type="text" className="input-field" value={formData.reference} onChange={e => setFormData({...formData, reference: e.target.value})} /></div>
          </div>
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <button type="button" className="btn-secondary" onClick={() => { setIsModalOpen(false); setEditingTransaction(null); setFormData(initialForm) }}>Cancel</button>
            <button type="submit" className="btn-primary">Save Transaction</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={isDeleteOpen} onClose={() => setIsDeleteOpen(false)} onConfirm={() => { if(selectedTransaction) deleteTransaction(selectedTransaction.id) }} title="Delete Transaction?" message={`Are you sure you want to permanently delete this financial transaction?`} />
    </div>
    </PinGuard>
  )
}
