import { useEffect, useState, useRef } from 'react'
import { Plus, Edit2, Trash2, Printer, FileText, FileSpreadsheet, Download, TrendingUp, TrendingDown, DollarSign, BarChart3, Filter, X } from 'lucide-react'
import { useFinanceStore } from '../../store/useFinanceStore'
import DataTable from '../../components/ui/DataTable'
import { Badge } from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import PinGuard from '../../components/ui/PinGuard'
import { formatUGX } from '../../utils/formatters'
import { format } from 'date-fns'
import * as XLSX from 'xlsx'

export default function Finance() {
  const { transactions, loadTransactions, getMonthlyStats, getDailyStats, addTransaction, updateTransaction, deleteTransaction } = useFinanceStore()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState(null)
  const [selectedTransaction, setSelectedTransaction] = useState(null)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [filterType, setFilterType] = useState('All')
  const [filterSource, setFilterSource] = useState('All')
  const [filterCategory, setFilterCategory] = useState('All')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const initialForm = { date: format(new Date(), 'yyyy-MM-dd'), type: 'Expense', source: 'Bank', category: 'Feed', amount: '', description: '', reference: '' }
  const [formData, setFormData] = useState(initialForm)
  const excelInputRef = useRef(null)

  useEffect(() => { loadTransactions() }, [])

  /* ──────────────────────── Excel Import ──────────────────────── */
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

        for (const sheetName of wb.SheetNames) {
          const ws = wb.Sheets[sheetName]
          const rawRows = XLSX.utils.sheet_to_json(ws, { defval: '', header: 1 })
          if (rawRows.length === 0) continue

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

              const rAmount = Number(row[5]) || 0
              const rClient = String(row[1] || '').trim()
              const rParticulars = String(row[2] || '').trim()
              const rLowerClient = rClient.toLowerCase()
              const rLowerPart = rParticulars.toLowerCase()
              const isBalBF = rLowerClient.includes('bal') || rLowerClient.includes('b/f') || rLowerPart.includes('bal') || rLowerPart.includes('b/f')

              if (rAmount > 0 && !isBalBF) {
                await addTransaction({ date: parseExcelDate(row[0]) || todayStr, type: 'Income', source: 'Petty Cash', category: 'Petty Cash Receipt', amount: rAmount, description: `${rClient} - ${rParticulars}`.replace(/^[\s\-]+|[\s\-]+$/g, '') || 'Petty cash receipt', reference: String(row[6] || '') })
                importedCount++
              }

              const pAmount = Number(row[11]) || 0
              const pRecipient = String(row[9] || '').trim()
              const pParticulars = String(row[10] || '').trim()
              const pLowerRec = pRecipient.toLowerCase()
              const pLowerPart = pParticulars.toLowerCase()
              const isPBalBF = pLowerRec.includes('bal') || pLowerRec.includes('b/f') || pLowerPart.includes('bal') || pLowerPart.includes('b/f')

              if (pAmount > 0 && !isPBalBF) {
                const pSource = String(row[12] || '').toLowerCase() === 'bank' ? 'Bank' : 'Petty Cash'
                await addTransaction({ date: parseExcelDate(row[8]) || todayStr, type: 'Expense', source: pSource, category: pParticulars || 'General Expense', amount: pAmount, description: `${pRecipient} - ${pParticulars}`.replace(/^[\s\-]+|[\s\-]+$/g, '') || 'Petty cash payment', reference: String(row[12] || '') })
                importedCount++
              }
            }
          } else {
            const flatData = XLSX.utils.sheet_to_json(ws)
            for (const row of flatData) {
              const amount = Number(row.Amount) || 0
              if (amount > 0) {
                await addTransaction({ date: row.Date || format(new Date(), 'yyyy-MM-dd'), type: row.Type || 'Expense', source: row['Payment Method'] === 'Bank' ? 'Bank' : 'Petty Cash', category: row.Category || 'General Expense', amount, description: row.Description || 'Imported item', reference: row.Reference || '' })
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

  /* ──────────────────────── Filtered Data ──────────────────────── */
  const filteredTransactions = transactions.filter(t => {
    if (filterType !== 'All' && t.type !== filterType) return false
    if (filterSource !== 'All' && t.source !== filterSource) return false
    if (filterCategory !== 'All' && t.category !== filterCategory) return false
    if (dateFrom && t.date < dateFrom) return false
    if (dateTo && t.date > dateTo) return false
    return true
  })

  const clearFilters = () => {
    setFilterType('All')
    setFilterSource('All')
    setFilterCategory('All')
    setDateFrom('')
    setDateTo('')
  }

  const hasActiveFilters = filterType !== 'All' || filterSource !== 'All' || filterCategory !== 'All' || dateFrom || dateTo

  /* ──────────────────────── Stats ──────────────────────── */
  const monthStats = getMonthlyStats()
  const dailyStats = getDailyStats()

  // Compute totals from filtered data
  const filteredIncome = filteredTransactions.filter(t => t.type === 'Income').reduce((s, t) => s + (t.amount || 0), 0)
  const filteredExpenses = filteredTransactions.filter(t => t.type === 'Expense').reduce((s, t) => s + (t.amount || 0), 0)
  const filteredProfit = filteredIncome - filteredExpenses

  /* ──────────────────────── Export Excel ──────────────────────── */
  const handleExportExcel = () => {
    const exportData = filteredTransactions.map(t => ({
      'Date': t.date,
      'Type': t.type,
      'Category': t.category,
      'Source': t.source || 'Bank',
      'Amount (Ushs)': t.amount,
      'Description': t.description || '',
      'Reference': t.reference || ''
    }))

    // Summary rows
    const summaryRows = [
      {},
      { 'Date': 'SUMMARY', 'Type': '', 'Category': '', 'Source': '', 'Amount (Ushs)': '' },
      { 'Date': 'Total Income', 'Amount (Ushs)': filteredIncome },
      { 'Date': 'Total Expenses', 'Amount (Ushs)': filteredExpenses },
      { 'Date': 'Net Profit', 'Amount (Ushs)': filteredProfit },
    ]

    const ws = XLSX.utils.json_to_sheet([...exportData, ...summaryRows])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Finance Ledger')
    XLSX.writeFile(wb, `JBS_Farm_Finance_${format(new Date(), 'yyyy-MM-dd')}.xlsx`)
  }

  /* ──────────────────────── Print (Fixed blank-page bug) ──────────────────────── */
  const handlePrint = () => {
    const rows = filteredTransactions
    const totalIncome = rows.filter(t => t.type === 'Income').reduce((s, t) => s + (t.amount || 0), 0)
    const totalExpenses = rows.filter(t => t.type === 'Expense').reduce((s, t) => s + (t.amount || 0), 0)
    const netProfit = totalIncome - totalExpenses

    const formatDate = (d) => { try { return format(new Date(d), 'dd MMM yyyy') } catch { return d } }
    const fmt = (n) => `Ushs ${Number(n || 0).toLocaleString('en-UG')}`

    const tableRows = rows.map((t, i) => `
      <tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'}">
        <td>${formatDate(t.date)}</td>
        <td>${t.type}</td>
        <td>${t.category}</td>
        <td>${t.source || 'Bank'}</td>
        <td style="text-align:right;font-weight:600;color:${t.type === 'Income' ? '#166534' : '#991b1b'}">${t.type === 'Income' ? '+' : '-'}${fmt(t.amount)}</td>
        <td>${t.description || '—'}</td>
        <td>${t.reference || '—'}</td>
      </tr>`).join('')

    const printHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>JBS Farm – Finance Ledger</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 9pt; color: #111; background: #fff; padding: 12mm 10mm; }
    .header { border-bottom: 2px solid #1a3c1a; padding-bottom: 6pt; margin-bottom: 12pt; display: flex; justify-content: space-between; align-items: flex-end; }
    .header h1 { font-size: 16pt; color: #1a3c1a; font-weight: 700; }
    .header p { font-size: 8pt; color: #555; }
    .kpi-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8pt; margin-bottom: 12pt; }
    .kpi { border: 1px solid #ddd; border-radius: 4pt; padding: 6pt 8pt; }
    .kpi .label { font-size: 7.5pt; color: #666; text-transform: uppercase; letter-spacing: 0.3pt; margin-bottom: 2pt; }
    .kpi .value { font-size: 13pt; font-weight: 700; }
    .kpi.income .value { color: #166534; }
    .kpi.expense .value { color: #991b1b; }
    .kpi.profit .value { color: ${netProfit >= 0 ? '#166534' : '#991b1b'}; }
    table { width: 100%; border-collapse: collapse; font-size: 8pt; }
    thead tr { background: #1a3c1a; color: #fff; }
    th { padding: 5pt 6pt; text-align: left; font-weight: 700; font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.3pt; border: 1px solid #0f2a0f; }
    td { padding: 4pt 6pt; border: 1px solid #e5e7eb; vertical-align: top; }
    tfoot tr { background: #f3f4f6; font-weight: 700; }
    tfoot td { border-top: 2px solid #1a3c1a; }
    .print-date { font-size: 7pt; color: #888; margin-top: 10pt; text-align: right; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>JBS Farm Management System</h1>
      <p>Financial Ledger Report &nbsp;|&nbsp; ${rows.length} transaction(s)</p>
    </div>
    <div style="text-align:right">
      <p style="font-size:8pt;color:#555">Generated: ${format(new Date(), 'dd MMM yyyy, HH:mm')}</p>
      ${hasActiveFilters ? `<p style="font-size:7.5pt;color:#888">Filtered view</p>` : ''}
    </div>
  </div>

  <div class="kpi-row">
    <div class="kpi income">
      <div class="label">Total Income</div>
      <div class="value">${fmt(totalIncome)}</div>
    </div>
    <div class="kpi expense">
      <div class="label">Total Expenses</div>
      <div class="value">${fmt(totalExpenses)}</div>
    </div>
    <div class="kpi profit">
      <div class="label">Net Profit / Loss</div>
      <div class="value">${netProfit >= 0 ? '+' : ''}${fmt(netProfit)}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Type</th>
        <th>Category</th>
        <th>Source</th>
        <th style="text-align:right">Amount</th>
        <th>Description</th>
        <th>Reference</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows || '<tr><td colspan="7" style="text-align:center;padding:20pt;color:#888">No transactions found</td></tr>'}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="4" style="text-align:right">TOTALS:</td>
        <td style="text-align:right;color:#166534">+${fmt(totalIncome)}&nbsp;/&nbsp;<span style="color:#991b1b">-${fmt(totalExpenses)}</span></td>
        <td colspan="2" style="color:${netProfit >= 0 ? '#166534' : '#991b1b'}">Net: ${netProfit >= 0 ? '+' : ''}${fmt(netProfit)}</td>
      </tr>
    </tfoot>
  </table>
  <p class="print-date">JBS Farm Management System — Confidential</p>
</body>
</html>`

    const win = window.open('', '_blank', 'width=900,height=700')
    win.document.write(printHtml)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 500)
  }

  /* ──────────────────────── Export PDF ──────────────────────── */
  const handleExportPDF = () => {
    // Reuse the print window — just open without auto-print so user can save-as-PDF
    const rows = filteredTransactions
    const totalIncome = rows.filter(t => t.type === 'Income').reduce((s, t) => s + (t.amount || 0), 0)
    const totalExpenses = rows.filter(t => t.type === 'Expense').reduce((s, t) => s + (t.amount || 0), 0)
    const netProfit = totalIncome - totalExpenses

    const formatDate = (d) => { try { return format(new Date(d), 'dd MMM yyyy') } catch { return d } }
    const fmt = (n) => `Ushs ${Number(n || 0).toLocaleString('en-UG')}`

    const tableRows = rows.map((t, i) => `
      <tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'}">
        <td>${formatDate(t.date)}</td>
        <td>${t.type}</td>
        <td>${t.category}</td>
        <td>${t.source || 'Bank'}</td>
        <td style="text-align:right;font-weight:600;color:${t.type === 'Income' ? '#166534' : '#991b1b'}">${t.type === 'Income' ? '+' : '-'}${fmt(t.amount)}</td>
        <td>${t.description || '—'}</td>
        <td>${t.reference || '—'}</td>
      </tr>`).join('')

    const printHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>JBS Farm – Finance Ledger</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 9pt; color: #111; background: #fff; padding: 12mm 10mm; }
    .header { border-bottom: 2px solid #1a3c1a; padding-bottom: 6pt; margin-bottom: 12pt; display: flex; justify-content: space-between; align-items: flex-end; }
    .header h1 { font-size: 16pt; color: #1a3c1a; font-weight: 700; }
    .header p { font-size: 8pt; color: #555; }
    .kpi-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8pt; margin-bottom: 12pt; }
    .kpi { border: 1px solid #ddd; border-radius: 4pt; padding: 6pt 8pt; }
    .kpi .label { font-size: 7.5pt; color: #666; text-transform: uppercase; letter-spacing: 0.3pt; margin-bottom: 2pt; }
    .kpi .value { font-size: 13pt; font-weight: 700; }
    .kpi.income .value { color: #166534; }
    .kpi.expense .value { color: #991b1b; }
    .kpi.profit .value { color: ${netProfit >= 0 ? '#166534' : '#991b1b'}; }
    table { width: 100%; border-collapse: collapse; font-size: 8pt; }
    thead tr { background: #1a3c1a; color: #fff; }
    th { padding: 5pt 6pt; text-align: left; font-weight: 700; font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.3pt; border: 1px solid #0f2a0f; }
    td { padding: 4pt 6pt; border: 1px solid #e5e7eb; vertical-align: top; }
    tfoot tr { background: #f3f4f6; font-weight: 700; }
    tfoot td { border-top: 2px solid #1a3c1a; }
    .pdf-hint { margin-top: 12pt; padding: 8pt; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 4pt; font-size: 8pt; color: #1e40af; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>JBS Farm Management System</h1>
      <p>Financial Ledger Report &nbsp;|&nbsp; ${rows.length} transaction(s)</p>
    </div>
    <div style="text-align:right">
      <p style="font-size:8pt;color:#555">Generated: ${format(new Date(), 'dd MMM yyyy, HH:mm')}</p>
    </div>
  </div>

  <div class="kpi-row">
    <div class="kpi income">
      <div class="label">Total Income</div>
      <div class="value">${fmt(totalIncome)}</div>
    </div>
    <div class="kpi expense">
      <div class="label">Total Expenses</div>
      <div class="value">${fmt(totalExpenses)}</div>
    </div>
    <div class="kpi profit">
      <div class="label">Net Profit / Loss</div>
      <div class="value">${netProfit >= 0 ? '+' : ''}${fmt(netProfit)}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Date</th><th>Type</th><th>Category</th><th>Source</th>
        <th style="text-align:right">Amount</th><th>Description</th><th>Reference</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows || '<tr><td colspan="7" style="text-align:center;padding:20pt;color:#888">No transactions found</td></tr>'}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="4" style="text-align:right">TOTALS:</td>
        <td style="text-align:right;color:#166534">+${fmt(totalIncome)}&nbsp;/&nbsp;<span style="color:#991b1b">-${fmt(totalExpenses)}</span></td>
        <td colspan="2" style="color:${netProfit >= 0 ? '#166534' : '#991b1b'}">Net: ${netProfit >= 0 ? '+' : ''}${fmt(netProfit)}</td>
      </tr>
    </tfoot>
  </table>

  <div class="pdf-hint">
    💡 To save as PDF: Press <strong>Ctrl+P</strong> → Change destination to <strong>"Save as PDF"</strong> → Click Save
  </div>
</body>
</html>`

    const win = window.open('', '_blank', 'width=950,height=700')
    win.document.write(printHtml)
    win.document.close()
    win.focus()
  }

  /* ──────────────────────── Form Save ──────────────────────── */
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

  /* ──────────────────────── Table columns ──────────────────────── */
  const columns = [
    {
      key: 'date', label: 'Date',
      render: (val) => <span className="text-slate-300 whitespace-nowrap">{(() => { try { return format(new Date(val), 'dd MMM yyyy') } catch { return val } })()}</span>
    },
    {
      key: 'type', label: 'Type',
      render: (val) => <Badge variant={val === 'Income' ? 'green' : 'red'}>{val}</Badge>
    },
    {
      key: 'category', label: 'Category',
      render: (val) => <span className="font-medium text-white text-xs">{val}</span>
    },
    {
      key: 'source', label: 'Source',
      render: (val) => (
        <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${val === 'Bank' ? 'bg-blue-500/15 text-blue-300' : 'bg-amber-500/15 text-amber-300'}`}>
          {val || 'Bank'}
        </span>
      )
    },
    {
      key: 'amount', label: 'Amount',
      render: (val, row) => (
        <span className={`font-bold tabular-nums whitespace-nowrap ${row.type === 'Income' ? 'text-green-400' : 'text-red-400'}`}>
          {row.type === 'Income' ? '+' : '-'}{formatUGX(val)}
        </span>
      )
    },
    {
      key: 'description', label: 'Description',
      render: (val) => <span className="text-slate-400 text-xs" title={val}>{val ? (val.length > 45 ? val.slice(0, 45) + '…' : val) : '—'}</span>
    },
    {
      key: 'reference', label: 'Ref',
      render: (val) => <span className="text-slate-500 text-xs">{val || '—'}</span>
    },
    {
      key: 'actions', label: '', sortable: false,
      render: (_, row) => (
        <div className="flex items-center gap-1 print:hidden" onClick={e => e.stopPropagation()}>
          <button onClick={() => {
            setEditingTransaction(row)
            setFormData({ date: row.date, type: row.type || 'Expense', source: row.source || 'Bank', category: row.category || 'Feed', amount: String(row.amount), description: row.description || '', reference: row.reference || '' })
            setIsModalOpen(true)
          }} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-500 hover:text-white transition-colors" title="Edit">
            <Edit2 size={14} />
          </button>
          <button onClick={() => { setSelectedTransaction(row); setIsDeleteOpen(true) }} className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors" title="Delete">
            <Trash2 size={14} />
          </button>
        </div>
      )
    }
  ]

  const categoriesList = ['Feed', 'Veterinary/Drugs', 'Salaries', 'Rent', 'Security', 'Member Withdraw Savings', 'Transport', 'Utilities', 'Maintenance', 'Bank Charges', 'Other Expense']
  const uniqueCategories = [...new Set(transactions.map(t => t.category).filter(Boolean))]

  return (
    <PinGuard>
      <div className="space-y-4">

        {/* ── Page Header ── */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="page-title">Financial Management</h1>
            <p className="text-slate-400 text-sm mt-0.5">Track income, expenses &amp; farm profitability</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input type="file" accept=".xlsx,.xls,.csv" onChange={handleExpenseExcelImport} ref={excelInputRef} className="hidden" />
            <button onClick={() => excelInputRef.current.click()} className="btn-secondary text-xs flex items-center gap-1.5 py-1.5 px-3">
              <FileSpreadsheet size={14} /> Import Excel
            </button>
            <button onClick={handleExportExcel} className="btn-secondary text-xs flex items-center gap-1.5 py-1.5 px-3" title="Export to Excel">
              <Download size={14} /> Export Excel
            </button>
            <button onClick={handleExportPDF} className="btn-secondary text-xs flex items-center gap-1.5 py-1.5 px-3" title="Export to PDF">
              <FileText size={14} /> Export PDF
            </button>
            <button onClick={handlePrint} className="btn-secondary text-xs flex items-center gap-1.5 py-1.5 px-3" title="Print Ledger">
              <Printer size={14} /> Print
            </button>
            <button className="btn-primary text-xs flex items-center gap-1.5 py-1.5 px-3" onClick={() => setIsModalOpen(true)}>
              <Plus size={14} /> Add Transaction
            </button>
          </div>
        </div>

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="glass-card p-4 border-l-4 border-l-green-500">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-slate-400 mb-1">Today's Revenue</p>
                <p className="text-xl font-display font-bold text-white leading-tight">{formatUGX(dailyStats.income)}</p>
              </div>
              <div className="p-2 rounded-xl bg-green-500/15">
                <TrendingUp size={16} className="text-green-400" />
              </div>
            </div>
          </div>
          <div className="glass-card p-4 border-l-4 border-l-emerald-400">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-slate-400 mb-1">Monthly Income</p>
                <p className="text-xl font-display font-bold text-white leading-tight">{formatUGX(monthStats.income)}</p>
              </div>
              <div className="p-2 rounded-xl bg-emerald-500/15">
                <DollarSign size={16} className="text-emerald-400" />
              </div>
            </div>
          </div>
          <div className="glass-card p-4 border-l-4 border-l-red-500">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-slate-400 mb-1">Monthly Expenses</p>
                <p className="text-xl font-display font-bold text-white leading-tight">{formatUGX(monthStats.expenses)}</p>
              </div>
              <div className="p-2 rounded-xl bg-red-500/15">
                <TrendingDown size={16} className="text-red-400" />
              </div>
            </div>
          </div>
          <div className="glass-card p-4 border-l-4 border-l-blue-500">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-slate-400 mb-1">Net Profit (Month)</p>
                <p className={`text-xl font-display font-bold leading-tight ${monthStats.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatUGX(monthStats.profit)}</p>
              </div>
              <div className="p-2 rounded-xl bg-blue-500/15">
                <BarChart3 size={16} className="text-blue-400" />
              </div>
            </div>
          </div>
        </div>

        {/* ── Filters Bar ── */}
        <div className="glass-card px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-slate-400">
              <Filter size={14} />
              <span className="text-xs font-medium">Filters:</span>
            </div>

            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="text-xs rounded-lg px-2.5 py-1.5 border outline-none transition-colors"
              style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)', color: 'var(--color-text-primary)' }}
            >
              <option value="All">All Types</option>
              <option value="Income">Income</option>
              <option value="Expense">Expense</option>
            </select>

            <select
              value={filterSource}
              onChange={e => setFilterSource(e.target.value)}
              className="text-xs rounded-lg px-2.5 py-1.5 border outline-none transition-colors"
              style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)', color: 'var(--color-text-primary)' }}
            >
              <option value="All">All Sources</option>
              <option value="Bank">Bank</option>
              <option value="Petty Cash">Petty Cash</option>
            </select>

            <select
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
              className="text-xs rounded-lg px-2.5 py-1.5 border outline-none transition-colors"
              style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)', color: 'var(--color-text-primary)' }}
            >
              <option value="All">All Categories</option>
              {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            <input
              type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="text-xs rounded-lg px-2.5 py-1.5 border outline-none transition-colors"
              style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)', color: 'var(--color-text-primary)' }}
              title="From date"
            />
            <span className="text-slate-500 text-xs">to</span>
            <input
              type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="text-xs rounded-lg px-2.5 py-1.5 border outline-none transition-colors"
              style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)', color: 'var(--color-text-primary)' }}
              title="To date"
            />

            {hasActiveFilters && (
              <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors ml-auto">
                <X size={12} /> Clear
              </button>
            )}

            {/* Filtered summary pill */}
            <div className="ml-auto flex items-center gap-3 text-xs">
              <span className="text-slate-500">{filteredTransactions.length} record{filteredTransactions.length !== 1 ? 's' : ''}</span>
              <span className="text-green-400 font-semibold">+{formatUGX(filteredIncome)}</span>
              <span className="text-red-400 font-semibold">-{formatUGX(filteredExpenses)}</span>
              <span className={`font-bold ${filteredProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                Net: {filteredProfit >= 0 ? '+' : ''}{formatUGX(filteredProfit)}
              </span>
            </div>
          </div>
        </div>

        {/* ── Transaction Ledger ── */}
        <div className="glass-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
            <h3 className="font-display font-semibold text-white text-sm">Transaction Ledger</h3>
            <span className="text-xs text-slate-500">{filteredTransactions.length} of {transactions.length} transactions</span>
          </div>
          <DataTable columns={columns} data={filteredTransactions} pageSize={15} />
        </div>

        {/* ── Add / Edit Modal ── */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => { setIsModalOpen(false); setEditingTransaction(null); setFormData(initialForm) }}
          title={editingTransaction ? 'Edit Transaction' : 'Add Financial Transaction'}
        >
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Transaction Type *</label>
                <select required className="input-field" value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })}>
                  <option value="Expense">Expense (Outgoing)</option>
                  <option value="Income">Income (Incoming)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Payment Source *</label>
                <select required className="input-field" value={formData.source} onChange={e => setFormData({ ...formData, source: e.target.value })}>
                  <option value="Bank">Bank Account</option>
                  <option value="Petty Cash">Petty Cash</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Date *</label>
                <input required type="date" className="input-field" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Category *</label>
                <select required className="input-field" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                  {categoriesList.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Amount (Ushs) *</label>
                <input required type="number" className="input-field" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Reference / Receipt No.</label>
                <input type="text" className="input-field" value={formData.reference} onChange={e => setFormData({ ...formData, reference: e.target.value })} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-400 mb-1">Description *</label>
                <input required type="text" className="input-field" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="e.g. Bought 10 bags of Dairy Meal" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              <button type="button" className="btn-secondary" onClick={() => { setIsModalOpen(false); setEditingTransaction(null); setFormData(initialForm) }}>Cancel</button>
              <button type="submit" className="btn-primary">Save Transaction</button>
            </div>
          </form>
        </Modal>

        <ConfirmDialog
          isOpen={isDeleteOpen}
          onClose={() => setIsDeleteOpen(false)}
          onConfirm={() => { if (selectedTransaction) deleteTransaction(selectedTransaction.id) }}
          title="Delete Transaction?"
          message="Are you sure you want to permanently delete this financial transaction?"
        />
      </div>
    </PinGuard>
  )
}
