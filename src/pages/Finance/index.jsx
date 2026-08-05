import { useEffect, useState, useRef, useMemo } from 'react'
import { Plus, Edit2, Trash2, Printer, FileText, FileSpreadsheet, Download, TrendingUp, TrendingDown, DollarSign, BarChart3, Filter, X, ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import { useFinanceStore } from '../../store/useFinanceStore'
import { useMilkStore } from '../../store/useMilkStore'
import DataTable from '../../components/ui/DataTable'
import { Badge } from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import PinGuard from '../../components/ui/PinGuard'
import { formatUGX } from '../../utils/formatters'
import { format } from 'date-fns'
import * as XLSX from 'xlsx'

/* ──────────────────────── Monthly Revenue Panel ──────────────────────── */
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const MILK_PRICE_PER_LITRE = 1500

const formatDateClean = (dStr) => {
  if (!dStr) return '—'
  try {
    const parts = String(dStr).split('-')
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10)
      const m = parseInt(parts[1], 10) - 1
      const d = parseInt(parts[2], 10)
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        return format(new Date(y, m, d), 'dd MMM yyyy')
      }
    }
    return format(new Date(dStr), 'dd MMM yyyy')
  } catch (_) {
    return dStr
  }
}

export default function Finance() {
  const { transactions, loadTransactions, getMonthlyStats, getDailyStats, addTransaction, updateTransaction, deleteTransaction, clearAllTransactions } = useFinanceStore()
  const { records: milkRecords, loadRecords: loadMilkRecords } = useMilkStore()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState(null)
  const [selectedTransaction, setSelectedTransaction] = useState(null)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [filterType, setFilterType] = useState('All')
  const [filterSource, setFilterSource] = useState('All')
  const [filterCategory, setFilterCategory] = useState('All')
  const [filterMonth, setFilterMonth] = useState('All')

  // Monthly Revenue Panel state
  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [selectedMonthIdx, setSelectedMonthIdx] = useState(new Date().getMonth()) // 0-based
  const [milkPricePerLitre, setMilkPricePerLitre] = useState(1500)

  const initialForm = { date: format(new Date(), 'yyyy-MM-dd'), type: 'Expense', source: 'Bank', category: 'Feed', amount: '', description: '', reference: '' }
  const [formData, setFormData] = useState(initialForm)
  const excelInputRef = useRef(null)

  useEffect(() => { loadTransactions(); loadMilkRecords() }, [])

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
            // Infer fallback month/year from sheet name if possible
            const lowerSheet = sheetName.toLowerCase()
            let sheetYear = 2026
            let sheetMonth = 6 // Default July (0-indexed: 6 = July)
            if (lowerSheet.includes('jan')) sheetMonth = 0
            else if (lowerSheet.includes('feb')) sheetMonth = 1
            else if (lowerSheet.includes('mar')) sheetMonth = 2
            else if (lowerSheet.includes('apr')) sheetMonth = 3
            else if (lowerSheet.includes('may')) sheetMonth = 4
            else if (lowerSheet.includes('june') || lowerSheet.includes('jun')) sheetMonth = 5
            else if (lowerSheet.includes('july') || lowerSheet.includes('jul')) sheetMonth = 6
            else if (lowerSheet.includes('aug')) sheetMonth = 7
            else if (lowerSheet.includes('sep') || lowerSheet.includes('tracker 9')) sheetMonth = 8
            else if (lowerSheet.includes('oct') || lowerSheet.includes('tracker 10')) sheetMonth = 9
            else if (lowerSheet.includes('nov') || lowerSheet.includes('tracker 11')) sheetMonth = 10
            else if (lowerSheet.includes('dec') || lowerSheet.includes('tracker 12')) sheetMonth = 11

            const defaultSheetDateStr = format(new Date(sheetYear, sheetMonth, 1), 'yyyy-MM-dd')

            const parseExcelDate = (val) => {
              if (val === null || val === undefined || val === '') return null
              if (typeof val === 'number') {
                const date = new Date((val - 25569) * 86400 * 1000)
                try { return format(date, 'yyyy-MM-dd') } catch (_) { return null }
              }
              try {
                const str = String(val).trim()
                // Handle DD/MM/YYYY or DD-MM-YYYY format
                const match = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/)
                if (match) {
                  let d = parseInt(match[1], 10)
                  let m = parseInt(match[2], 10) - 1
                  let y = parseInt(match[3], 10)
                  if (y < 100) y += 2000
                  return format(new Date(y, m, d), 'yyyy-MM-dd')
                }
                const parsed = new Date(str)
                if (!isNaN(parsed.getTime())) return format(parsed, 'yyyy-MM-dd')
              } catch (_) {}
              return null
            }

            let lastReceiptDate = defaultSheetDateStr
            let lastPaymentDate = defaultSheetDateStr

            for (let i = headerIndex + 1; i < rawRows.length; i++) {
              const row = rawRows[i]
              if (!row || row.length === 0) continue

              const rDateParsed = parseExcelDate(row[0])
              if (rDateParsed) lastReceiptDate = rDateParsed

              const rAmount = Number(row[5]) || 0
              const rClient = String(row[1] || '').trim()
              const rParticulars = String(row[2] || '').trim()
              const rLowerClient = rClient.toLowerCase()
              const rLowerPart = rParticulars.toLowerCase()
              const isBalBF = rLowerClient.includes('bal') || rLowerClient.includes('b/f') || rLowerPart.includes('bal') || rLowerPart.includes('b/f')

              if (rAmount > 0 && !isBalBF) {
                await addTransaction({ date: lastReceiptDate, type: 'Income', source: 'Petty Cash', category: 'Petty Cash Receipt', amount: rAmount, description: `${rClient} - ${rParticulars}`.replace(/^[\s\-]+|[\s\-]+$/g, '') || 'Petty cash receipt', reference: String(row[6] || '') })
                importedCount++
              }

              const pDateParsed = parseExcelDate(row[8])
              if (pDateParsed) lastPaymentDate = pDateParsed

              const pAmount = Number(row[11]) || 0
              const pRecipient = String(row[9] || '').trim()
              const pParticulars = String(row[10] || '').trim()
              const pLowerRec = pRecipient.toLowerCase()
              const pLowerPart = pParticulars.toLowerCase()
              const isPBalBF = pLowerRec.includes('bal') || pLowerRec.includes('b/f') || pLowerPart.includes('bal') || pLowerPart.includes('b/f')

              if (pAmount > 0 && !isPBalBF) {
                const pSource = String(row[12] || '').toLowerCase() === 'bank' ? 'Bank' : 'Petty Cash'
                await addTransaction({ date: lastPaymentDate, type: 'Expense', source: pSource, category: pParticulars || 'General Expense', amount: pAmount, description: `${pRecipient} - ${pParticulars}`.replace(/^[\s\-]+|[\s\-]+$/g, '') || 'Petty cash payment', reference: String(row[12] || '') })
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
        // Push all newly imported transactions to Supabase for cross-device visibility
        try {
          const { forceUploadSaccoToSupabase } = await import('../../services/supabaseSyncEngine')
          await forceUploadSaccoToSupabase()
        } catch (err) {
          console.warn('Post-import cloud sync notice:', err)
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
    if (filterMonth !== 'All' && t.date && !t.date.startsWith(filterMonth)) return false
    return true
  })

  const clearFilters = () => {
    setFilterType('All')
    setFilterSource('All')
    setFilterCategory('All')
    setFilterMonth('All')
  }

  const hasActiveFilters = filterType !== 'All' || filterSource !== 'All' || filterCategory !== 'All' || filterMonth !== 'All'

  /* ──────────────────────── Monthly Revenue Computation ──────────────────────── */
  const allMonthlyData = useMemo(() => {
    // Build stats for every month in the selected year
    return Array.from({ length: 12 }, (_, mIdx) => {
      const prefix = `${selectedYear}-${String(mIdx + 1).padStart(2, '0')}`

      // Finance transactions for this month
      const monthTxs = transactions.filter(t => t.date && t.date.startsWith(prefix))
      const income = monthTxs.filter(t => t.type === 'Income').reduce((s, t) => s + (t.amount || 0), 0)
      const expenses = monthTxs.filter(t => t.type === 'Expense').reduce((s, t) => s + (t.amount || 0), 0)

      // Category breakdown for the month
      const catMap = {}
      monthTxs.forEach(t => { catMap[t.category] = (catMap[t.category] || 0) + (t.amount || 0) })
      const categories = Object.entries(catMap)
        .map(([name, amount]) => ({ name, amount }))
        .sort((a, b) => b.amount - a.amount)

      // Milk records for this month
      const monthMilk = milkRecords.filter(r => r.date && r.date.startsWith(prefix))
      const milkLitres = monthMilk.reduce((s, r) => s + (r.amount || 0), 0)
      const calvesLitres = monthMilk.reduce((s, r) => s + (r.calvesAmount || 0), 0)
      const netMilkLitres = Math.max(0, milkLitres - calvesLitres)
      const milkRevenue = netMilkLitres * milkPricePerLitre
      const milkSessions = monthMilk.length

      return {
        monthIdx: mIdx,
        label: SHORT_MONTHS[mIdx],
        fullLabel: MONTH_NAMES[mIdx],
        income,
        expenses,
        profit: income + milkRevenue - expenses,
        txCount: monthTxs.length,
        categories,
        // Milk
        milkLitres,
        calvesLitres,
        netMilkLitres,
        milkRevenue,
        milkSessions,
        hasData: monthTxs.length > 0 || monthMilk.length > 0
      }
    })
  }, [transactions, milkRecords, selectedYear, milkPricePerLitre])

  const selectedMonthData = allMonthlyData[selectedMonthIdx]
  const maxBarValue = Math.max(...allMonthlyData.map(m => Math.max(m.income, m.expenses, m.milkRevenue)), 1)

  // Available years from transaction + milk data
  const availableYears = useMemo(() => {
    const years = new Set([
      ...transactions.map(t => t.date?.slice(0, 4)),
      ...milkRecords.map(r => r.date?.slice(0, 4))
    ].filter(Boolean))
    years.add(String(currentYear))
    return [...years].map(Number).sort((a, b) => b - a)
  }, [transactions, milkRecords, currentYear])

  // Available months for the filter dropdown (sorted latest first)
  const availableMonths = useMemo(() => {
    const prefixes = new Set(transactions.map(t => t.date?.slice(0, 7)).filter(Boolean))
    return [...prefixes].sort((a, b) => b.localeCompare(a)).map(prefix => {
      const [y, m] = prefix.split('-')
      return { value: prefix, label: `${MONTH_NAMES[parseInt(m, 10) - 1]} ${y}` }
    })
  }, [transactions])

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
    try {
      const payload = { ...formData, amount: Number(formData.amount) || 0 }
      if (editingTransaction) {
        await updateTransaction(editingTransaction.id, payload)
      } else {
        await addTransaction(payload)
      }
      setIsModalOpen(false)
      setEditingTransaction(null)
      setFormData(initialForm)
    } catch (err) {
      console.error('Failed to save transaction:', err)
      alert('Failed to save transaction: ' + (err.message || 'Unknown error'))
    }
  }

  /* ──────────────────────── Table columns ──────────────────────── */
  const columns = [
    {
      key: 'date', label: 'Date',
      render: (val) => <span className="text-slate-300 whitespace-nowrap font-medium">{formatDateClean(val)}</span>
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
    <div className="space-y-4">

        {/* ── Page Header ── */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="page-title">Petty Cash Utilization</h1>
            <p className="text-slate-400 text-sm mt-0.5">Track income, petty cash expenses &amp; farm profitability</p>
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
            <button
              className="text-xs flex items-center gap-1.5 py-1.5 px-3 rounded-xl font-medium border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
              onClick={async () => {
                if (window.confirm('⚠️ This will permanently delete ALL petty cash transactions from all devices. You can then re-import your Excel file fresh.\n\nAre you sure?')) {
                  await clearAllTransactions()
                  alert('✅ All transactions cleared. You can now re-import your Excel file.')
                }
              }}
              title="Delete all transactions and re-import"
            >
              <Trash2 size={14} /> Clear All
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

        {/* ── Monthly Revenue Panel ── */}
        <div className="glass-card overflow-hidden">
          {/* Panel header: title + milk price input + year picker */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
            <div className="flex items-center gap-2">
              <Calendar size={15} className="text-emerald-400" />
              <h3 className="font-display font-semibold text-white text-sm">Monthly Revenue Overview</h3>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {/* Milk price per litre input */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-500 whitespace-nowrap">🥛 Price / Litre</span>
                <div className="flex items-center rounded-lg overflow-hidden border" style={{ borderColor: 'rgba(6,182,212,0.35)', background: 'rgba(6,182,212,0.08)' }}>
                  <span className="px-2 text-[10px] text-cyan-400 font-medium border-r" style={{ borderColor: 'rgba(6,182,212,0.25)' }}>Ushs</span>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={milkPricePerLitre}
                    onChange={e => setMilkPricePerLitre(Math.max(0, Number(e.target.value) || 0))}
                    className="w-20 bg-transparent text-xs font-bold text-cyan-300 px-2 py-1.5 outline-none text-right"
                    title="Milk price per litre — change this to update all milk revenue calculations"
                  />
                  <span className="px-2 text-[10px] text-slate-500">/L</span>
                </div>
              </div>
              {/* Year selector */}
              <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  const newYear = selectedYear - 1
                  setSelectedYear(newYear)
                  if (filterMonth !== 'All') {
                    const mStr = String(selectedMonthIdx + 1).padStart(2, '0')
                    setFilterMonth(`${newYear}-${mStr}`)
                  }
                }}
                className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              >
                <ChevronLeft size={15} />
              </button>
              <select
                value={selectedYear}
                onChange={e => {
                  const newYear = Number(e.target.value)
                  setSelectedYear(newYear)
                  if (filterMonth !== 'All') {
                    const mStr = String(selectedMonthIdx + 1).padStart(2, '0')
                    setFilterMonth(`${newYear}-${mStr}`)
                  }
                }}
                className="text-xs font-semibold rounded-lg px-3 py-1.5 border outline-none"
                style={{ background: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.15)', color: '#f8fafc' }}
              >
                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <button
                onClick={() => {
                  const newYear = selectedYear + 1
                  setSelectedYear(newYear)
                  if (filterMonth !== 'All') {
                    const mStr = String(selectedMonthIdx + 1).padStart(2, '0')
                    setFilterMonth(`${newYear}-${mStr}`)
                  }
                }}
                disabled={selectedYear >= currentYear}
                className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors disabled:opacity-30"
              >
                <ChevronRight size={15} />
              </button>
            </div>
            </div>
          </div>

          {/* Month pill tabs */}
          <div className="flex items-stretch gap-1 px-4 pt-4 pb-1 overflow-x-auto scrollbar-thin">
            {allMonthlyData.map(m => (
              <button
                key={m.monthIdx}
                onClick={() => {
                  setSelectedMonthIdx(m.monthIdx)
                  const y = String(selectedYear)
                  const mStr = String(m.monthIdx + 1).padStart(2, '0')
                  setFilterMonth(`${y}-${mStr}`)
                }}
                className={`flex-shrink-0 flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200 min-w-[56px]
                  ${selectedMonthIdx === m.monthIdx
                    ? 'bg-emerald-500/25 border border-emerald-500/50 text-emerald-300'
                    : m.hasData
                      ? 'bg-white/05 border border-white/08 text-slate-300 hover:bg-white/10'
                      : 'bg-transparent border border-dashed border-white/08 text-slate-600 cursor-default'}`}
              >
                <span className="font-semibold">{m.label}</span>
                {m.hasData ? (
                  <span className={`text-[10px] ${m.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {m.profit >= 0 ? '+' : ''}{m.profit >= 1e6 ? (m.profit / 1e6).toFixed(1) + 'M' : m.profit >= 1e3 ? (m.profit / 1e3).toFixed(0) + 'K' : m.profit}
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-700">—</span>
                )}
              </button>
            ))}
          </div>

          {/* Visual bar chart + selected month detail */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 divide-y lg:divide-y-0 lg:divide-x" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>

            {/* Bar chart — all 12 months */}
            <div className="col-span-2 px-5 py-4">
              <p className="text-xs text-slate-500 mb-3 uppercase tracking-wider">Revenue vs Expenses — {selectedYear}</p>
              <div className="flex items-end gap-1.5 h-28">
                {allMonthlyData.map(m => {
                  const incH = m.income > 0 ? Math.max(4, (m.income / maxBarValue) * 96) : 0
                  const expH = m.expenses > 0 ? Math.max(4, (m.expenses / maxBarValue) * 96) : 0
                  const milkH = m.milkRevenue > 0 ? Math.max(4, (m.milkRevenue / maxBarValue) * 96) : 0
                  const isSelected = m.monthIdx === selectedMonthIdx
                  return (
                    <button
                      key={m.monthIdx}
                      onClick={() => {
                        setSelectedMonthIdx(m.monthIdx)
                        const y = String(selectedYear)
                        const mStr = String(m.monthIdx + 1).padStart(2, '0')
                        setFilterMonth(`${y}-${mStr}`)
                      }}
                      className="flex-1 flex flex-col items-center gap-0.5 group cursor-pointer"
                      title={`${m.fullLabel}\nIncome: ${formatUGX(m.income)}\nMilk: ${formatUGX(m.milkRevenue)} (${m.netMilkLitres.toFixed(1)}L)\nExpenses: ${formatUGX(m.expenses)}`}
                    >
                      <div className="w-full flex items-end justify-center gap-px" style={{ height: 96 }}>
                        {/* Finance Income bar */}
                        <div
                          style={{ height: incH, minHeight: m.income > 0 ? 4 : 0 }}
                          className={`w-[30%] rounded-t transition-all duration-300 ${
                            isSelected ? 'bg-emerald-400' : m.hasData ? 'bg-emerald-500/50 group-hover:bg-emerald-500/80' : 'bg-white/05'
                          }`}
                        />
                        {/* Milk Revenue bar */}
                        <div
                          style={{ height: milkH, minHeight: m.milkRevenue > 0 ? 4 : 0 }}
                          className={`w-[30%] rounded-t transition-all duration-300 ${
                            isSelected ? 'bg-cyan-400' : m.milkRevenue > 0 ? 'bg-cyan-500/50 group-hover:bg-cyan-500/80' : 'bg-white/05'
                          }`}
                        />
                        {/* Expense bar */}
                        <div
                          style={{ height: expH, minHeight: m.expenses > 0 ? 4 : 0 }}
                          className={`w-[30%] rounded-t transition-all duration-300 ${
                            isSelected ? 'bg-red-400' : m.hasData ? 'bg-red-500/50 group-hover:bg-red-500/80' : 'bg-white/05'
                          }`}
                        />
                      </div>
                      <span className={`text-[9px] font-medium ${
                        isSelected ? 'text-emerald-300' : m.hasData ? 'text-slate-400' : 'text-slate-700'
                      }`}>{m.label}</span>
                    </button>
                  )
                })}
              </div>
              {/* Legend */}
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-2 rounded-sm bg-emerald-500/70" />
                  <span className="text-[10px] text-slate-500">Finance Income</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-2 rounded-sm bg-cyan-500/70" />
                  <span className="text-[10px] text-slate-500">Milk Income</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-2 rounded-sm bg-red-500/70" />
                  <span className="text-[10px] text-slate-500">Expenses</span>
                </div>
                <span className="text-[10px] text-slate-600 ml-auto">Click a bar to view details</span>
              </div>
            </div>

            {/* Selected month detail */}
            <div className="px-5 py-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-white">{selectedMonthData.fullLabel} {selectedYear}</p>
                <span className="text-[10px] text-slate-500">{selectedMonthData.txCount} tx · {selectedMonthData.milkSessions} milk sessions</span>
              </div>

              {selectedMonthData.hasData ? (
                <>
                  {/* Income / Milk / Expenses / Net */}
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">Finance Income</span>
                      <span className="text-xs font-bold text-green-400">{formatUGX(selectedMonthData.income)}</span>
                    </div>
                    {/* Milk income row */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-cyan-400 flex items-center gap-1">
                        🥛 Milk Income
                      </span>
                      <span className="text-xs font-bold text-cyan-400">{formatUGX(selectedMonthData.milkRevenue)}</span>
                    </div>
                    {selectedMonthData.netMilkLitres > 0 && (
                      <div className="flex items-center justify-between pl-3">
                        <span className="text-[10px] text-slate-600">{selectedMonthData.netMilkLitres.toFixed(1)} L net · {selectedMonthData.calvesLitres.toFixed(1)} L calves</span>
                        <span className="text-[10px] text-slate-600">{selectedMonthData.milkLitres.toFixed(1)} L total</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">Expenses</span>
                      <span className="text-xs font-bold text-red-400">-{formatUGX(selectedMonthData.expenses)}</span>
                    </div>
                    <div className="h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-white">Net Profit</span>
                      <span className={`text-sm font-bold ${
                        selectedMonthData.profit >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {selectedMonthData.profit >= 0 ? '+' : ''}{formatUGX(selectedMonthData.profit)}
                      </span>
                    </div>
                  </div>

                  {/* Category breakdown */}
                  {selectedMonthData.categories.length > 0 && (
                    <>
                      <p className="text-[10px] uppercase tracking-wider text-slate-600 mb-2">By Category</p>
                      <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                        {selectedMonthData.categories.slice(0, 8).map(cat => {
                          const total = selectedMonthData.income + selectedMonthData.expenses
                          const pct = total > 0 ? Math.round((cat.amount / total) * 100) : 0
                          return (
                            <div key={cat.name}>
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="text-[10px] text-slate-400 truncate max-w-[110px]" title={cat.name}>{cat.name}</span>
                                <span className="text-[10px] text-slate-300 font-medium">{formatUGX(cat.amount)}</span>
                              </div>
                              <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-blue-500 transition-all duration-500"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )}

                  {/* Quick filter button */}
                  <button
                    onClick={() => {
                      const y = String(selectedYear)
                      const m = String(selectedMonthIdx + 1).padStart(2, '0')
                      setFilterMonth(`${y}-${m}`)
                      setFilterType('All')
                      setFilterSource('All')
                      setFilterCategory('All')
                    }}
                    className="mt-3 w-full text-[11px] py-1.5 rounded-lg font-medium transition-all hover:opacity-90"
                    style={{ background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.25)', color: '#6ee7b7' }}
                  >
                    View {selectedMonthData.label} Transactions
                  </button>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-32 text-slate-600">
                  <span className="text-2xl mb-1">📋</span>
                  <span className="text-xs">No transactions or milk records in {selectedMonthData.fullLabel}</span>
                </div>
              )}
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

            <select
              value={filterMonth}
              onChange={e => {
                const val = e.target.value
                setFilterMonth(val)
                if (val !== 'All') {
                  const [y, m] = val.split('-').map(Number)
                  if (y) setSelectedYear(y)
                  if (m) setSelectedMonthIdx(m - 1)
                }
              }}
              className="text-xs rounded-lg px-2.5 py-1.5 border outline-none transition-colors font-medium"
              style={{ background: 'rgba(255,255,255,0.08)', borderColor: filterMonth !== 'All' ? 'rgba(52,211,153,0.4)' : 'rgba(255,255,255,0.12)', color: '#f8fafc' }}
            >
              <option value="All">All Months</option>
              {availableMonths.map(mo => (
                <option key={mo.value} value={mo.value}>{mo.label}</option>
              ))}
            </select>

            {hasActiveFilters && (
              <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors">
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
  )
}
