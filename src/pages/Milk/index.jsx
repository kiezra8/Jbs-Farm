import { useEffect, useState } from 'react'
import { Plus, Edit2, Trash2, FileText, FileSpreadsheet, Printer, ChevronLeft, ChevronRight, Calendar, BarChart2 } from 'lucide-react'
import { useMilkStore } from '../../store/useMilkStore'
import { useAnimalStore } from '../../store/useAnimalStore'
import DataTable from '../../components/ui/DataTable'
import { Badge } from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { formatLiters, formatUGX } from '../../utils/formatters'
import { format, startOfWeek, addDays, subWeeks, addWeeks } from 'date-fns'
import { exportToPDF, exportToExcel } from '../../utils/exporters'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

export default function Milk() {
  const { records, loadRecords, getStats, getDailyTotals, addRecord, updateRecord, deleteRecord } = useMilkStore()
  const { animals, loadAnimals } = useAnimalStore()

  const [viewMode, setViewMode] = useState('daily') // 'daily' | 'weekly'

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState(null)
  const [editingRow, setEditingRow] = useState(null)

  const initialForm = { animalId: '', date: format(new Date(), 'yyyy-MM-dd'), session: 'Morning', amount: '', calvesAmount: '' }
  const [formData, setFormData] = useState(initialForm)
  const [selectedDateFilter, setSelectedDateFilter] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [selectedWeekDate, setSelectedWeekDate] = useState(format(new Date(), 'yyyy-MM-dd'))

  useEffect(() => { loadRecords(); loadAnimals() }, [])

  const stats = getStats()
  const dailyTotals = getDailyTotals(7)
  const recordsForDate = records.filter(r => r.date === selectedDateFilter)

  // ─── Daily View Pivoted Data ────────────────────────────────────────────────
  const cowMap = {}
  animals.filter(a => a.gender === 'Female').forEach(a => {
    cowMap[a.id] = {
      id: a.id,
      animalId: a.id,
      animalName: a.name || 'Unknown',
      tagNumber: a.tagNumber || 'N/A',
      Morning: 0,
      Afternoon: 0,
      Evening: 0,
      calvesAmount: 0,
      totalAmount: 0,
      records: {}
    }
  })
  recordsForDate.forEach(r => {
    if (!cowMap[r.animalId]) {
      const animal = animals.find(a => String(a.id) === String(r.animalId))
      cowMap[r.animalId] = {
        id: r.animalId,
        animalId: r.animalId,
        animalName: animal?.name || 'Unknown',
        tagNumber: animal?.tagNumber || 'N/A',
        Morning: 0,
        Afternoon: 0,
        Evening: 0,
        calvesAmount: 0,
        totalAmount: 0,
        records: {}
      }
    }
    const row = cowMap[r.animalId]
    row[r.session] += Number(r.amount) || 0
    row.calvesAmount += Number(r.calvesAmount) || 0
    row.totalAmount += Number(r.amount) || 0
    row.records[r.session] = r
  })

  const pivotedData = Object.values(cowMap).sort((a, b) => {
    if (a.totalAmount > 0 && b.totalAmount === 0) return -1;
    if (a.totalAmount === 0 && b.totalAmount > 0) return 1;
    return b.totalAmount - a.totalAmount;
  })

  // ─── Weekly View Computation ───────────────────────────────────────────────
  const targetWeekDate = new Date(selectedWeekDate)
  const weekStart = startOfWeek(isNaN(targetWeekDate.getTime()) ? new Date() : targetWeekDate, { weekStartsOn: 1 })
  const weekEnd = addDays(weekStart, 6)
  
  const weekDays = [0, 1, 2, 3, 4, 5, 6].map(offset => {
    const d = addDays(weekStart, offset)
    const dateStr = format(d, 'yyyy-MM-dd')
    const dayName = format(d, 'EEEE')
    const formattedDate = format(d, 'dd MMM yyyy')
    const dayRecords = records.filter(r => r.date === dateStr)

    let morning = 0, afternoon = 0, evening = 0, calves = 0, total = 0
    dayRecords.forEach(r => {
      const amt = Number(r.amount) || 0
      const cAmt = Number(r.calvesAmount) || 0
      if (r.session === 'Morning') morning += amt
      if (r.session === 'Afternoon') afternoon += amt
      if (r.session === 'Evening') evening += amt
      calves += cAmt
      total += amt
    })
    const net = Math.max(0, total - calves)
    const revenue = net * 1500

    return {
      date: dateStr,
      dayName,
      formattedDate,
      morning,
      afternoon,
      evening,
      calves,
      total,
      net,
      revenue,
      recordCount: dayRecords.length
    }
  })

  const weekSummary = weekDays.reduce((acc, d) => {
    acc.morning += d.morning
    acc.afternoon += d.afternoon
    acc.evening += d.evening
    acc.calves += d.calves
    acc.total += d.total
    acc.net += d.net
    acc.revenue += d.revenue
    return acc
  }, { morning: 0, afternoon: 0, evening: 0, calves: 0, total: 0, net: 0, revenue: 0 })

  // ─── Export & Print Handlers for Weekly Report ─────────────────────────────
  const handleWeeklyExportPDF = () => {
    const columns = [
      { key: 'dayName', header: 'Day' },
      { key: 'formattedDate', header: 'Date' },
      { key: 'morningStr', header: 'Morning' },
      { key: 'afternoonStr', header: 'Afternoon' },
      { key: 'eveningStr', header: 'Evening' },
      { key: 'totalStr', header: 'Total Yield' },
      { key: 'calvesStr', header: 'Given to Calves' },
      { key: 'netStr', header: 'Net Remained' },
      { key: 'revenueStr', header: 'Revenue (UGX)' }
    ]

    const rows = weekDays.map(d => ({
      ...d,
      morningStr: formatLiters(d.morning),
      afternoonStr: formatLiters(d.afternoon),
      eveningStr: formatLiters(d.evening),
      totalStr: formatLiters(d.total),
      calvesStr: formatLiters(d.calves),
      netStr: formatLiters(d.net),
      revenueStr: formatUGX(d.revenue)
    }))

    rows.push({
      dayName: 'WEEK TOTAL',
      formattedDate: '',
      morningStr: formatLiters(weekSummary.morning),
      afternoonStr: formatLiters(weekSummary.afternoon),
      eveningStr: formatLiters(weekSummary.evening),
      totalStr: formatLiters(weekSummary.total),
      calvesStr: formatLiters(weekSummary.calves),
      netStr: formatLiters(weekSummary.net),
      revenueStr: formatUGX(weekSummary.revenue)
    })

    const title = `Weekly Milk Production Report (${format(weekStart, 'dd MMM')} - ${format(weekEnd, 'dd MMM yyyy')})`
    exportToPDF({ title, columns, rows, filename: `Weekly_Milk_Report_${format(weekStart, 'yyyyMMdd')}` })
  }

  const handleWeeklyExportExcel = () => {
    const columns = [
      { key: 'dayName', header: 'Day' },
      { key: 'formattedDate', header: 'Date' },
      { key: 'morningStr', header: 'Morning (L)' },
      { key: 'afternoonStr', header: 'Afternoon (L)' },
      { key: 'eveningStr', header: 'Evening (L)' },
      { key: 'totalStr', header: 'Total Yield (L)' },
      { key: 'calvesStr', header: 'Given to Calves (L)' },
      { key: 'netStr', header: 'Net Remained (L)' },
      { key: 'revenueStr', header: 'Revenue (UGX)' }
    ]

    const rows = weekDays.map(d => ({
      ...d,
      morningStr: d.morning,
      afternoonStr: d.afternoon,
      eveningStr: d.evening,
      totalStr: d.total,
      calvesStr: d.calves,
      netStr: d.net,
      revenueStr: d.revenue
    }))

    rows.push({
      dayName: 'WEEK TOTAL',
      formattedDate: '',
      morningStr: weekSummary.morning,
      afternoonStr: weekSummary.afternoon,
      eveningStr: weekSummary.evening,
      totalStr: weekSummary.total,
      calvesStr: weekSummary.calves,
      netStr: weekSummary.net,
      revenueStr: weekSummary.revenue
    })

    const title = `Weekly Milk Report ${format(weekStart, 'dd MMM')} - ${format(weekEnd, 'dd MMM yyyy')}`
    exportToExcel({ title, columns, rows, filename: `Weekly_Milk_Report_${format(weekStart, 'yyyyMMdd')}` })
  }

  const handleWeeklyPrint = () => {
    document.body.setAttribute('data-print-title', `Weekly Milk Report (${format(weekStart, 'dd MMM')} - ${format(weekEnd, 'dd MMM yyyy')})`)
    window.print()
  }

  // ─── Modal & Form Handlers ──────────────────────────────────────────────────
  const editRowRecord = (row) => {
    setEditingRow(row)
    const existingRecord = row.records['Morning']
    if (existingRecord) {
      setEditingRecord(existingRecord)
      setFormData({
        animalId: existingRecord.animalId,
        date: existingRecord.date,
        session: 'Morning',
        amount: String(existingRecord.amount),
        calvesAmount: String(existingRecord.calvesAmount || '')
      })
    } else {
      setEditingRecord(null)
      setFormData({
        animalId: row.animalId,
        date: selectedDateFilter,
        session: 'Morning',
        amount: '',
        calvesAmount: ''
      })
    }
    setIsModalOpen(true)
  }

  const editSessionRecord = (row, session) => {
    setEditingRow(row)
    const existingRecord = row.records[session]
    if (existingRecord) {
      setEditingRecord(existingRecord)
      setFormData({
        animalId: existingRecord.animalId,
        date: existingRecord.date,
        session: session,
        amount: String(existingRecord.amount),
        calvesAmount: String(existingRecord.calvesAmount || '')
      })
    } else {
      setEditingRecord(null)
      setFormData({
        animalId: row.animalId,
        date: selectedDateFilter,
        session: session,
        amount: '',
        calvesAmount: ''
      })
    }
    setIsModalOpen(true)
  }

  const handleSessionChange = (e) => {
    const session = e.target.value
    const existingRecord = editingRow?.records?.[session]
    if (existingRecord) {
      setEditingRecord(existingRecord)
      setFormData({
        ...formData,
        session,
        amount: String(existingRecord.amount),
        calvesAmount: String(existingRecord.calvesAmount || '')
      })
    } else {
      setEditingRecord(null)
      setFormData({
        ...formData,
        session,
        amount: '',
        calvesAmount: ''
      })
    }
  }

  const SessionCell = ({ val, row, session }) => {
    if (val > 0) {
      return <span className="text-white font-medium">{formatLiters(val)}</span>
    }
    return (
      <button 
        onClick={() => editSessionRecord(row, session)} 
        className="text-xs text-slate-500 hover:text-white px-2 py-1 rounded hover:bg-white/10 transition-colors flex items-center gap-1"
      >
        <Plus size={12} /> Add
      </button>
    )
  }

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
    setEditingRow(null)
    setFormData(initialForm)
  }

  const columns = [
    { key: 'tagNumber', label: 'Cow', render: (val, row) => (
      <div><p className="font-medium text-white">{val}</p><p className="text-xs text-slate-400">{row.animalName}</p></div>
    )},
    { key: 'Morning', label: 'Morning', render: (val, row) => <SessionCell val={val} row={row} session="Morning" /> },
    { key: 'Afternoon', label: 'Afternoon', render: (val, row) => <SessionCell val={val} row={row} session="Afternoon" /> },
    { key: 'Evening', label: 'Evening', render: (val, row) => <SessionCell val={val} row={row} session="Evening" /> },
    { key: 'totalAmount', label: 'Total', render: (val) => <span className="text-white font-bold">{formatLiters(val)}</span> },
    { key: 'calvesAmount', label: 'To Calves', render: (val) => formatLiters(val || 0) },
    { key: 'netAmount', label: 'Net', render: (_, row) => formatLiters((row.totalAmount || 0) - (row.calvesAmount || 0)) },
    { key: 'actions', label: 'Action', sortable: false, render: (_, row) => (
      <button onClick={() => editRowRecord(row)} className="btn-secondary px-3 py-1.5 text-xs text-white flex items-center gap-2">
        <Edit2 size={14} /> Edit
      </button>
    )},
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="page-title">Milk Production</h1>
          <p className="text-slate-400 text-sm mt-1">Track daily milking sessions, calves consumption, and weekly reports.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* View Toggle */}
          <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
            <button
              onClick={() => setViewMode('daily')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${viewMode === 'daily' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              <Calendar size={14} /> Daily View
            </button>
            <button
              onClick={() => setViewMode('weekly')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${viewMode === 'weekly' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              <BarChart2 size={14} /> Weekly Report
            </button>
          </div>

          {viewMode === 'daily' ? (
            <>
              <input 
                 type="date" 
                 className="input-field bg-white/5 border-white/10 text-xs py-1.5 px-3" 
                 value={selectedDateFilter}
                 onChange={e => setSelectedDateFilter(e.target.value)}
                 title="Select Date"
                 required
              />
              <button className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1.5" onClick={() => { setEditingRow(null); setEditingRecord(null); setFormData(initialForm); setIsModalOpen(true) }}>
                <Plus size={16} /> Add Yield
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedWeekDate(format(subWeeks(new Date(selectedWeekDate), 1), 'yyyy-MM-dd'))}
                className="btn-secondary py-1.5 px-2 text-xs"
                title="Previous Week"
              >
                <ChevronLeft size={16} />
              </button>
              <input 
                 type="date" 
                 className="input-field bg-white/5 border-white/10 text-xs py-1.5 px-3" 
                 value={selectedWeekDate}
                 onChange={e => setSelectedWeekDate(e.target.value)}
                 title="Select Week Date"
                 required
              />
              <button
                onClick={() => setSelectedWeekDate(format(addWeeks(new Date(selectedWeekDate), 1), 'yyyy-MM-dd'))}
                className="btn-secondary py-1.5 px-2 text-xs"
                title="Next Week"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Overview Cards (Daily Mode) */}
      {viewMode === 'daily' && (
        <>
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

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="glass-card p-4 flex items-center justify-between border-l-2 border-l-rose-500">
              <div><p className="text-xs text-slate-400">Given to Calves Today</p><p className="text-2xl font-display font-bold text-white">{formatLiters(stats.todayCalves)}</p></div><span className="text-2xl opacity-80">🍼</span>
            </div>
            <div className="glass-card p-4 flex items-center justify-between border-l-2 border-l-teal-500">
              <div><p className="text-xs text-slate-400">Net Amount Today</p><p className="text-2xl font-display font-bold text-white">{formatLiters(stats.todayNet)}</p></div><span className="text-2xl opacity-80">📦</span>
            </div>
            <div className="glass-card p-4 flex items-center justify-between border-l-2 border-l-emerald-500">
              <div><p className="text-xs text-slate-400">Today's Revenue</p><p className="text-xl font-display font-bold text-white">{new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX' }).format(stats.todayRevenue)}</p></div><span className="text-2xl opacity-80">💰</span>
            </div>
            <div className="glass-card p-4 flex items-center justify-between border-l-2 border-l-indigo-500">
              <div><p className="text-xs text-slate-400">Month's Revenue</p><p className="text-xl font-display font-bold text-white">{new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX' }).format(stats.monthRevenue)}</p></div><span className="text-2xl opacity-80">💎</span>
            </div>
          </div>

          <div className="glass-card p-5">
            <h3 className="text-xl font-display font-semibold text-white mb-4 pb-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              {selectedDateFilter ? format(new Date(selectedDateFilter), 'EEEE, dd MMMM yyyy') : 'All Dates'}
            </h3>
            <DataTable 
              columns={columns} 
              data={pivotedData} 
              pageSize={15} 
              emptyMessage={`No records for ${selectedDateFilter ? format(new Date(selectedDateFilter), 'dd MMM yyyy') : 'selected date'}`} 
            />
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
        </>
      )}

      {/* ─── WEEKLY REPORT VIEW ───────────────────────────────────────────────── */}
      {viewMode === 'weekly' && (
        <div className="space-y-6">
          {/* Weekly Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="glass-card p-4 border-l-4 border-l-blue-500">
              <p className="text-xs text-slate-400">Week Total Extracted</p>
              <p className="text-2xl font-display font-bold text-white mt-1">{formatLiters(weekSummary.total)}</p>
              <p className="text-[10px] text-slate-500 mt-1">{format(weekStart, 'dd MMM')} - {format(weekEnd, 'dd MMM yyyy')}</p>
            </div>
            <div className="glass-card p-4 border-l-4 border-l-rose-500">
              <p className="text-xs text-slate-400">Given to Calves (Week)</p>
              <p className="text-2xl font-display font-bold text-white mt-1">{formatLiters(weekSummary.calves)}</p>
              <p className="text-[10px] text-slate-500 mt-1">Calf Feeding Total</p>
            </div>
            <div className="glass-card p-4 border-l-4 border-l-teal-500">
              <p className="text-xs text-slate-400">Week Net Remained</p>
              <p className="text-2xl font-display font-bold text-white mt-1">{formatLiters(weekSummary.net)}</p>
              <p className="text-[10px] text-slate-500 mt-1">Available for Sale</p>
            </div>
            <div className="glass-card p-4 border-l-4 border-l-emerald-500">
              <p className="text-xs text-slate-400">Week Estimated Revenue</p>
              <p className="text-2xl font-display font-bold text-emerald-400 mt-1">{formatUGX(weekSummary.revenue)}</p>
              <p className="text-[10px] text-slate-500 mt-1">At UGX 1,500 / Litre</p>
            </div>
          </div>

          {/* Weekly Table Card */}
          <div className="glass-card p-5 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-white/10">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>🥛 Weekly Milk Production Report</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Daily breakdown for <span className="text-emerald-400 font-semibold">{format(weekStart, 'EEEE, dd MMMM')}</span> to <span className="text-emerald-400 font-semibold">{format(weekEnd, 'EEEE, dd MMMM yyyy')}</span>
                </p>
              </div>

              {/* Weekly Action Buttons */}
              <div className="flex items-center gap-2 print:hidden">
                <button
                  onClick={handleWeeklyExportPDF}
                  className="btn-secondary text-xs flex items-center gap-1.5 py-1.5 px-3"
                  title="Export Weekly PDF"
                >
                  <FileText size={14} className="text-red-400" /> PDF
                </button>
                <button
                  onClick={handleWeeklyExportExcel}
                  className="btn-secondary text-xs flex items-center gap-1.5 py-1.5 px-3"
                  title="Export Weekly Excel"
                >
                  <FileSpreadsheet size={14} className="text-green-400" /> Excel
                </button>
                <button
                  onClick={handleWeeklyPrint}
                  className="btn-secondary text-xs flex items-center gap-1.5 py-1.5 px-3"
                  title="Print Weekly Report"
                >
                  <Printer size={14} /> Print
                </button>
              </div>
            </div>

            {/* Weekly Daily Production Breakdown Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400 uppercase text-[10px] tracking-wider bg-white/5">
                    <th className="p-3">Day</th>
                    <th className="p-3">Date</th>
                    <th className="p-3 text-right">Morning</th>
                    <th className="p-3 text-right">Afternoon</th>
                    <th className="p-3 text-right">Evening</th>
                    <th className="p-3 text-right">Total Extracted</th>
                    <th className="p-3 text-right">Given to Calves</th>
                    <th className="p-3 text-right">Net Remained</th>
                    <th className="p-3 text-right">Daily Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {weekDays.map(day => (
                    <tr 
                      key={day.date} 
                      className={`hover:bg-white/5 transition-colors cursor-pointer ${day.total > 0 ? 'text-white' : 'text-slate-500'}`}
                      onClick={() => { setSelectedDateFilter(day.date); setViewMode('daily'); }}
                      title="Click to view daily details"
                    >
                      <td className="p-3 font-semibold text-white">{day.dayName}</td>
                      <td className="p-3 text-slate-400">{day.formattedDate}</td>
                      <td className="p-3 text-right font-mono">{day.morning > 0 ? formatLiters(day.morning) : '—'}</td>
                      <td className="p-3 text-right font-mono">{day.afternoon > 0 ? formatLiters(day.afternoon) : '—'}</td>
                      <td className="p-3 text-right font-mono">{day.evening > 0 ? formatLiters(day.evening) : '—'}</td>
                      <td className="p-3 text-right font-mono font-bold text-blue-400">{day.total > 0 ? formatLiters(day.total) : '0 L'}</td>
                      <td className="p-3 text-right font-mono text-rose-400">{day.calves > 0 ? formatLiters(day.calves) : '0 L'}</td>
                      <td className="p-3 text-right font-mono font-bold text-teal-400">{day.net > 0 ? formatLiters(day.net) : '0 L'}</td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-400">{day.revenue > 0 ? formatUGX(day.revenue) : 'UGX 0'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-emerald-500/50 bg-emerald-500/10 font-bold text-white text-sm">
                    <td className="p-3 text-emerald-400" colSpan={2}>WEEK TOTALS</td>
                    <td className="p-3 text-right font-mono text-xs">{formatLiters(weekSummary.morning)}</td>
                    <td className="p-3 text-right font-mono text-xs">{formatLiters(weekSummary.afternoon)}</td>
                    <td className="p-3 text-right font-mono text-xs">{formatLiters(weekSummary.evening)}</td>
                    <td className="p-3 text-right font-mono text-blue-400">{formatLiters(weekSummary.total)}</td>
                    <td className="p-3 text-right font-mono text-rose-400">{formatLiters(weekSummary.calves)}</td>
                    <td className="p-3 text-right font-mono text-teal-400">{formatLiters(weekSummary.net)}</td>
                    <td className="p-3 text-right font-mono text-emerald-400">{formatUGX(weekSummary.revenue)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal for adding / editing yield */}
      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingRecord(null); setEditingRow(null); setFormData(initialForm) }} title={editingRow && formData.animalId ? `Edit Yield: ${animals.find(a => String(a.id) === String(formData.animalId))?.tagNumber || 'Cow'}` : "Add Milk Yield"}>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-400 mb-1">Cow *</label>
              <select required className="input-field disabled:opacity-50" value={formData.animalId} onChange={e => setFormData({...formData, animalId: e.target.value})} disabled={!!editingRow}>
                <option value="">Select Milking Cow...</option>
                {animals.filter(a => a.gender === 'Female').map(a => <option key={a.id} value={a.id}>{a.tagNumber} ({a.name || 'Unnamed'})</option>)}
              </select>
            </div>
            <div><label className="block text-xs font-medium text-slate-400 mb-1">Date *</label><input required type="date" className="input-field" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} /></div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Session *</label>
              <select required className="input-field" value={formData.session} onChange={editingRow ? handleSessionChange : e => setFormData({...formData, session: e.target.value})}>
                <option>Morning</option><option>Afternoon</option><option>Evening</option>
              </select>
            </div>
            <div className="col-span-1"><label className="block text-xs font-medium text-slate-400 mb-1">Total Amount (Liters) *</label><input required type="number" step="0.1" className="input-field" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} /></div>
            <div className="col-span-1"><label className="block text-xs font-medium text-slate-400 mb-1">Given to Calves (L)</label><input type="number" step="0.1" className="input-field" value={formData.calvesAmount} onChange={e => setFormData({...formData, calvesAmount: e.target.value})} /></div>
          </div>
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <button type="button" className="btn-secondary" onClick={() => { setIsModalOpen(false); setEditingRecord(null); setEditingRow(null); setFormData(initialForm) }}>Cancel</button>
            <button type="submit" className="btn-primary">Save Record</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
