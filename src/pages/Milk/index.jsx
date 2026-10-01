import { useEffect, useState } from 'react'
import { Plus, Edit2, Trash2, FileText, FileSpreadsheet, ChevronLeft, ChevronRight, Calendar, BarChart2, Search, Check, X, Beef, Tag, History } from 'lucide-react'
import { useMilkStore } from '../../store/useMilkStore'
import { useAnimalStore } from '../../store/useAnimalStore'
import DataTable from '../../components/ui/DataTable'
import { Badge } from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { formatLiters, formatUGX } from '../../utils/formatters'
import { format, startOfWeek, addDays, subWeeks, addWeeks, startOfMonth, endOfMonth, eachDayOfInterval, subMonths, addMonths } from 'date-fns'
import { exportToPDF, exportToExcel } from '../../utils/exporters'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { loadHistoricalCowNames, saveHistoricalCowNames, buildUnifiedCowList } from '../../services/historicalCows'

export default function Milk() {
  const { records, loadRecords, getStats, getDailyTotals, addRecord, updateRecord, deleteRecord } = useMilkStore()
  const { animals, loadAnimals } = useAnimalStore()

  const [viewMode, setViewMode] = useState('daily') // 'daily' | 'weekly' | 'monthly'

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState(null)
  const [editingRow, setEditingRow] = useState(null)

  const initialForm = { animalId: '', date: format(new Date(), 'yyyy-MM-dd'), morning: '', afternoon: '', evening: '', calvesAmount: '', focusSession: 'morning' }
  const [formData, setFormData] = useState(initialForm)
  const [selectedDateFilter, setSelectedDateFilter] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [selectedWeekDate, setSelectedWeekDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [weeklyCowFilter, setWeeklyCowFilter] = useState('all')
  const [weeklyViewType, setWeeklyViewType] = useState('days') // 'days' | 'cows'
  const [selectedMonthFilter, setSelectedMonthFilter] = useState(format(new Date(), 'yyyy-MM'))
  const [monthlyCowFilter, setMonthlyCowFilter] = useState('all')
  const [monthlySearchQuery, setMonthlySearchQuery] = useState('')
  const [milkSearchQuery, setMilkSearchQuery] = useState('')
  const [cowTypeQuery, setCowTypeQuery] = useState('')

  // ─── Historical / Deleted Cow State ────────────────────────────────────────
  const [historicalNames, setHistoricalNames] = useState({})
  const [herdFilter, setHerdFilter] = useState('all') // 'all' | 'active' | 'previous'
  const [isNameModalOpen, setIsNameModalOpen] = useState(false)
  const [editHistoricalMap, setEditHistoricalMap] = useState({})

  useEffect(() => {
    loadRecords()
    loadAnimals()
    loadHistoricalCowNames().then(map => setHistoricalNames(map || {}))
  }, [])

  const stats = getStats()
  const dailyTotals = getDailyTotals(7)
  const recordsForDate = records.filter(r => r.date === selectedDateFilter)

  // ─── Unified Cow Resolution (Active Animals + Previous Herd) ──────────────
  const unifiedCows = buildUnifiedCowList(animals, records, historicalNames)
  const previousCows = unifiedCows.filter(c => c.isHistorical)
  const activeCows = unifiedCows.filter(c => !c.isHistorical)
  const cowsFilteredByHerd = unifiedCows.filter(c => {
    if (herdFilter === 'active') return !c.isHistorical
    if (herdFilter === 'previous') return c.isHistorical
    return true
  })

  // ─── Daily View Pivoted Data ────────────────────────────────────────────────
  const cowMap = {}
  cowsFilteredByHerd.forEach(a => {
    cowMap[a.id] = {
      id: a.id,
      animalId: a.id,
      animalName: a.name || 'Unknown',
      tagNumber: a.tagNumber || 'N/A',
      isHistorical: a.isHistorical,
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
      const cow = unifiedCows.find(a => String(a.id) === String(r.animalId))
      if (!cow && herdFilter === 'active') return
      cowMap[r.animalId] = {
        id: r.animalId,
        animalId: r.animalId,
        animalName: cow?.name || r.animalName || 'Previous Cow',
        tagNumber: cow?.tagNumber || r.tagNumber || 'OLD',
        isHistorical: cow ? cow.isHistorical : true,
        Morning: 0,
        Afternoon: 0,
        Evening: 0,
        calvesAmount: 0,
        totalAmount: 0,
        records: {}
      }
    }
    const row = cowMap[r.animalId]
    if (row) {
      row[r.session] += Number(r.amount) || 0
      row.calvesAmount += Number(r.calvesAmount) || 0
      row.totalAmount += Number(r.amount) || 0
      row.records[r.session] = r
    }
  })

  const pivotedData = Object.values(cowMap)
    .filter(row => (herdFilter === 'previous' ? row.totalAmount > 0 : true))
    .sort((a, b) => {
      if (a.totalAmount > 0 && b.totalAmount === 0) return -1;
      if (a.totalAmount === 0 && b.totalAmount > 0) return 1;
      return b.totalAmount - a.totalAmount;
    })

  const filteredDailyData = pivotedData.filter(row => {
    if (!milkSearchQuery) return true
    const q = milkSearchQuery.toLowerCase()
    return row.tagNumber?.toLowerCase().includes(q) || row.animalName?.toLowerCase().includes(q)
  })

  // Female cows for modal selector, filtered by cowTypeQuery
  const femaleCows = unifiedCows
  const filteredCowsForSelect = femaleCows.filter(c => {
    if (!cowTypeQuery) return true
    const q = cowTypeQuery.toLowerCase()
    return c.tagNumber?.toLowerCase().includes(q) || c.name?.toLowerCase().includes(q) || c.breed?.toLowerCase().includes(q)
  })
  const selectedCowObj = unifiedCows.find(a => String(a.id) === String(formData.animalId))

  // ─── Weekly View Computation ───────────────────────────────────────────────
  const targetWeekDate = new Date(selectedWeekDate)
  const weekStart = startOfWeek(isNaN(targetWeekDate.getTime()) ? new Date() : targetWeekDate, { weekStartsOn: 1 })
  const weekEnd = addDays(weekStart, 6)
  const weekStartStr = format(weekStart, 'yyyy-MM-dd')
  const weekEndStr = format(weekEnd, 'yyyy-MM-dd')
  const weekRecords = records.filter(r => r.date >= weekStartStr && r.date <= weekEndStr)
  
  // Weekly Days (All Cows or Selected Cow)
  const targetWeeklyCow = unifiedCows.find(a => String(a.id) === String(weeklyCowFilter))
  
  const weekDays = [0, 1, 2, 3, 4, 5, 6].map(offset => {
    const d = addDays(weekStart, offset)
    const dateStr = format(d, 'yyyy-MM-dd')
    const dayName = format(d, 'EEEE')
    const formattedDate = format(d, 'dd MMM yyyy')
    const dayRecords = records.filter(r => {
      if (r.date !== dateStr) return false
      if (weeklyCowFilter !== 'all') return String(r.animalId) === String(weeklyCowFilter)
      return true
    })

    let morning = 0, afternoon = 0, evening = 0, calves = 0, total = 0
    const recordsMap = {}
    dayRecords.forEach(r => {
      const amt = Number(r.amount) || 0
      const cAmt = Number(r.calvesAmount) || 0
      if (r.session === 'Morning') morning += amt
      if (r.session === 'Afternoon') afternoon += amt
      if (r.session === 'Evening') evening += amt
      calves += cAmt
      total += amt
      recordsMap[r.session] = r
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
      recordCount: dayRecords.length,
      records: recordsMap
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

  // All cows weekly table
  const allCowsWeekly = cowsFilteredByHerd.map(c => {
    const cowRecs = weekRecords.filter(r => String(r.animalId) === String(c.id))
    let m = 0, a = 0, ev = 0, calves = 0, total = 0
    cowRecs.forEach(r => {
      const amt = Number(r.amount) || 0
      const cAmt = Number(r.calvesAmount) || 0
      if (r.session === 'Morning') m += amt
      if (r.session === 'Afternoon') a += amt
      if (r.session === 'Evening') ev += amt
      calves += cAmt
      total += amt
    })
    const net = Math.max(0, total - calves)
    const revenue = net * 1500
    return {
      id: c.id,
      tagNumber: c.tagNumber || 'N/A',
      animalName: c.name || 'Unnamed',
      breed: c.breed || 'Dairy',
      isHistorical: c.isHistorical,
      morning: m,
      afternoon: a,
      evening: ev,
      total,
      calves,
      net,
      revenue
    }
  }).filter(c => {
    if (c.isHistorical) return c.total > 0
    return herdFilter === 'active' || c.total > 0
  }).sort((a, b) => b.total - a.total)

  // ─── Monthly View Computation ──────────────────────────────────────────────
  const [selYear, selMonth] = (selectedMonthFilter || format(new Date(), 'yyyy-MM')).split('-')
  const targetMonthDate = new Date(Number(selYear), Number(selMonth) - 1, 1)
  const monthStart = startOfMonth(isNaN(targetMonthDate.getTime()) ? new Date() : targetMonthDate)
  const monthEnd = endOfMonth(monthStart)
  const monthAllDays = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const monthTitle = format(monthStart, 'MMMM yyyy')
  const monthPrefix = format(monthStart, 'yyyy-MM')
  const monthRecords = records.filter(r => r.date && r.date.startsWith(monthPrefix))

  const targetMonthlyCow = unifiedCows.find(a => String(a.id) === String(monthlyCowFilter))

  // Days for specific cow in month
  const cowMonthDays = monthAllDays.map(d => {
    const dateStr = format(d, 'yyyy-MM-dd')
    const dayName = format(d, 'EEEE')
    const formattedDate = format(d, 'dd MMM yyyy')
    const dayRecords = monthRecords.filter(r => {
      if (r.date !== dateStr) return false
      if (monthlyCowFilter !== 'all') return String(r.animalId) === String(monthlyCowFilter)
      return true
    })

    let morning = 0, afternoon = 0, evening = 0, calves = 0, total = 0
    const recordsMap = {}
    dayRecords.forEach(r => {
      const amt = Number(r.amount) || 0
      const cAmt = Number(r.calvesAmount) || 0
      if (r.session === 'Morning') morning += amt
      if (r.session === 'Afternoon') afternoon += amt
      if (r.session === 'Evening') evening += amt
      calves += cAmt
      total += amt
      recordsMap[r.session] = r
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
      recordCount: dayRecords.length,
      records: recordsMap
    }
  })

  const cowMonthSummary = cowMonthDays.reduce((acc, d) => {
    acc.morning += d.morning
    acc.afternoon += d.afternoon
    acc.evening += d.evening
    acc.calves += d.calves
    acc.total += d.total
    acc.net += d.net
    acc.revenue += d.revenue
    if (d.total > 0) acc.daysMilked += 1
    return acc
  }, { morning: 0, afternoon: 0, evening: 0, calves: 0, total: 0, net: 0, revenue: 0, daysMilked: 0 })

  // All cows monthly table
  const allCowsMonthly = cowsFilteredByHerd.map(c => {
    const cowRecs = monthRecords.filter(r => String(r.animalId) === String(c.id))
    let m = 0, a = 0, ev = 0, calves = 0, total = 0
    const datesSet = new Set()
    cowRecs.forEach(r => {
      const amt = Number(r.amount) || 0
      const cAmt = Number(r.calvesAmount) || 0
      if (amt > 0) datesSet.add(r.date)
      if (r.session === 'Morning') m += amt
      if (r.session === 'Afternoon') a += amt
      if (r.session === 'Evening') ev += amt
      calves += cAmt
      total += amt
    })
    const net = Math.max(0, total - calves)
    const revenue = net * 1500
    return {
      id: c.id,
      animalId: c.id,
      tagNumber: c.tagNumber || 'N/A',
      animalName: c.name || 'Unnamed',
      breed: c.breed || 'Dairy',
      isHistorical: c.isHistorical,
      daysMilked: datesSet.size,
      morning: m,
      afternoon: a,
      evening: ev,
      total,
      calves,
      net,
      revenue,
      avgDaily: datesSet.size > 0 ? (total / datesSet.size).toFixed(1) : '0.0'
    }
  }).filter(c => {
    if (c.isHistorical) return c.total > 0
    return herdFilter === 'active' || c.total > 0
  }).sort((a, b) => b.total - a.total)

  const filteredMonthlyCows = allCowsMonthly.filter(c => {
    if (!monthlySearchQuery) return true
    const q = monthlySearchQuery.toLowerCase()
    return c.tagNumber.toLowerCase().includes(q) || c.animalName.toLowerCase().includes(q) || c.breed.toLowerCase().includes(q)
  })

  const monthTotalExtracted = allCowsMonthly.reduce((s, c) => s + c.total, 0)
  const monthTotalCalves = allCowsMonthly.reduce((s, c) => s + c.calves, 0)
  const monthTotalNet = allCowsMonthly.reduce((s, c) => s + c.net, 0)
  const monthTotalRevenue = allCowsMonthly.reduce((s, c) => s + c.revenue, 0)
  const activeMonthDaysCount = new Set(monthRecords.filter(r => (Number(r.amount) || 0) > 0).map(r => r.date)).size
  const monthDailyAvg = activeMonthDaysCount > 0 ? (monthTotalExtracted / activeMonthDaysCount).toFixed(1) : '0.0'

  // ─── Export & Print Handlers for Weekly Report ─────────────────────────────
  const handleWeeklyExportPDF = () => {
    if (weeklyCowFilter !== 'all' && targetWeeklyCow) {
      const columns = [
        { key: 'dayName', header: 'Day' },
        { key: 'formattedDate', header: 'Date' },
        { key: 'morningStr', header: 'Morning (L)' },
        { key: 'afternoonStr', header: 'Afternoon (L)' },
        { key: 'eveningStr', header: 'Evening (L)' },
        { key: 'totalStr', header: 'Total (L)' },
        { key: 'calvesStr', header: 'To Calves (L)' },
        { key: 'netStr', header: 'Net Sold (L)' },
        { key: 'revenueStr', header: 'Revenue (UGX)' }
      ]
      const rows = weekDays.map(d => ({
        dayName: d.dayName,
        formattedDate: d.formattedDate,
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
        formattedDate: `${targetWeeklyCow.breed || 'Dairy'}`,
        morningStr: formatLiters(weekSummary.morning),
        afternoonStr: formatLiters(weekSummary.afternoon),
        eveningStr: formatLiters(weekSummary.evening),
        totalStr: formatLiters(weekSummary.total),
        calvesStr: formatLiters(weekSummary.calves),
        netStr: formatLiters(weekSummary.net),
        revenueStr: formatUGX(weekSummary.revenue)
      })
      const title = `Weekly Milk Report - ${targetWeeklyCow.name || 'Cow'} (${targetWeeklyCow.tagNumber}) (${format(weekStart, 'dd MMM')} - ${format(weekEnd, 'dd MMM yyyy')})`
      exportToPDF({ title, columns, rows, filename: `Weekly_Milk_${(targetWeeklyCow.name || 'Cow').replace(/\s+/g, '_')}_${targetWeeklyCow.tagNumber}_${format(weekStart, 'yyyyMMdd')}` })
    } else if (weeklyViewType === 'cows') {
      const columns = [
        { key: 'tagNumber', header: 'Tag ID' },
        { key: 'animalName', header: 'Cow Name' },
        { key: 'breed', header: 'Breed' },
        { key: 'morningStr', header: 'Morning (L)' },
        { key: 'afternoonStr', header: 'Afternoon (L)' },
        { key: 'eveningStr', header: 'Evening (L)' },
        { key: 'totalStr', header: 'Week Total (L)' },
        { key: 'calvesStr', header: 'To Calves (L)' },
        { key: 'netStr', header: 'Net Sold (L)' },
        { key: 'revenueStr', header: 'Revenue (UGX)' }
      ]
      const rows = allCowsWeekly.map(c => ({
        tagNumber: c.tagNumber,
        animalName: c.animalName,
        breed: c.breed,
        morningStr: formatLiters(c.morning),
        afternoonStr: formatLiters(c.afternoon),
        eveningStr: formatLiters(c.evening),
        totalStr: formatLiters(c.total),
        calvesStr: formatLiters(c.calves),
        netStr: formatLiters(c.net),
        revenueStr: formatUGX(c.revenue)
      }))
      rows.push({
        tagNumber: 'TOTAL',
        animalName: `${allCowsWeekly.length} Cows`,
        breed: 'All Cows',
        morningStr: formatLiters(allCowsWeekly.reduce((s, c) => s + c.morning, 0)),
        afternoonStr: formatLiters(allCowsWeekly.reduce((s, c) => s + c.afternoon, 0)),
        eveningStr: formatLiters(allCowsWeekly.reduce((s, c) => s + c.evening, 0)),
        totalStr: formatLiters(allCowsWeekly.reduce((s, c) => s + c.total, 0)),
        calvesStr: formatLiters(allCowsWeekly.reduce((s, c) => s + c.calves, 0)),
        netStr: formatLiters(allCowsWeekly.reduce((s, c) => s + c.net, 0)),
        revenueStr: formatUGX(allCowsWeekly.reduce((s, c) => s + c.revenue, 0))
      })
      const title = `Weekly Milk Production Report (By Cow) (${format(weekStart, 'dd MMM')} - ${format(weekEnd, 'dd MMM yyyy')})`
      exportToPDF({ title, columns, rows, filename: `Weekly_Milk_By_Cow_${format(weekStart, 'yyyyMMdd')}` })
    } else {
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
  }

  const handleWeeklyExportExcel = () => {
    if (weeklyCowFilter !== 'all' && targetWeeklyCow) {
      const columns = [
        { key: 'dayName', header: 'Day' },
        { key: 'formattedDate', header: 'Date' },
        { key: 'morningStr', header: 'Morning (L)' },
        { key: 'afternoonStr', header: 'Afternoon (L)' },
        { key: 'eveningStr', header: 'Evening (L)' },
        { key: 'totalStr', header: 'Total (L)' },
        { key: 'calvesStr', header: 'To Calves (L)' },
        { key: 'netStr', header: 'Net Sold (L)' },
        { key: 'revenueStr', header: 'Revenue (UGX)' }
      ]
      const rows = weekDays.map(d => ({
        dayName: d.dayName,
        formattedDate: d.formattedDate,
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
        formattedDate: `${targetWeeklyCow.breed || 'Dairy'}`,
        morningStr: weekSummary.morning,
        afternoonStr: weekSummary.afternoon,
        eveningStr: weekSummary.evening,
        totalStr: weekSummary.total,
        calvesStr: weekSummary.calves,
        netStr: weekSummary.net,
        revenueStr: weekSummary.revenue
      })
      const title = `Weekly Milk - ${targetWeeklyCow.name || 'Cow'} (${targetWeeklyCow.tagNumber})`
      exportToExcel({ title, columns, rows, filename: `Weekly_Milk_${(targetWeeklyCow.name || 'Cow').replace(/\s+/g, '_')}_${targetWeeklyCow.tagNumber}_${format(weekStart, 'yyyyMMdd')}` })
    } else if (weeklyViewType === 'cows') {
      const columns = [
        { key: 'tagNumber', header: 'Tag ID' },
        { key: 'animalName', header: 'Cow Name' },
        { key: 'breed', header: 'Breed' },
        { key: 'morningStr', header: 'Morning (L)' },
        { key: 'afternoonStr', header: 'Afternoon (L)' },
        { key: 'eveningStr', header: 'Evening (L)' },
        { key: 'totalStr', header: 'Week Total (L)' },
        { key: 'calvesStr', header: 'To Calves (L)' },
        { key: 'netStr', header: 'Net Sold (L)' },
        { key: 'revenueStr', header: 'Revenue (UGX)' }
      ]
      const rows = allCowsWeekly.map(c => ({
        tagNumber: c.tagNumber,
        animalName: c.animalName,
        breed: c.breed,
        morningStr: c.morning,
        afternoonStr: c.afternoon,
        eveningStr: c.evening,
        totalStr: c.total,
        calvesStr: c.calves,
        netStr: c.net,
        revenueStr: c.revenue
      }))
      rows.push({
        tagNumber: 'TOTAL',
        animalName: `${allCowsWeekly.length} Cows`,
        breed: 'All Cows',
        morningStr: allCowsWeekly.reduce((s, c) => s + c.morning, 0),
        afternoonStr: allCowsWeekly.reduce((s, c) => s + c.afternoon, 0),
        eveningStr: allCowsWeekly.reduce((s, c) => s + c.evening, 0),
        totalStr: allCowsWeekly.reduce((s, c) => s + c.total, 0),
        calvesStr: allCowsWeekly.reduce((s, c) => s + c.calves, 0),
        netStr: allCowsWeekly.reduce((s, c) => s + c.net, 0),
        revenueStr: allCowsWeekly.reduce((s, c) => s + c.revenue, 0)
      })
      const title = `Weekly Milk (By Cow) ${format(weekStart, 'dd MMM')} - ${format(weekEnd, 'dd MMM yyyy')}`
      exportToExcel({ title, columns, rows, filename: `Weekly_Milk_By_Cow_${format(weekStart, 'yyyyMMdd')}` })
    } else {
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
  }

  // ─── Export Handlers for Monthly Report ────────────────────────────────────
  const handleMonthlyExportPDF = () => {
    if (monthlyCowFilter !== 'all' && targetMonthlyCow) {
      const columns = [
        { key: 'dayName', header: 'Day' },
        { key: 'formattedDate', header: 'Date' },
        { key: 'morningStr', header: 'Morning (L)' },
        { key: 'afternoonStr', header: 'Afternoon (L)' },
        { key: 'eveningStr', header: 'Evening (L)' },
        { key: 'totalStr', header: 'Total (L)' },
        { key: 'calvesStr', header: 'To Calves (L)' },
        { key: 'netStr', header: 'Net Sold (L)' },
        { key: 'revenueStr', header: 'Revenue (UGX)' }
      ]
      const rows = cowMonthDays.map(d => ({
        dayName: d.dayName,
        formattedDate: d.formattedDate,
        morningStr: d.morning > 0 ? formatLiters(d.morning) : '—',
        afternoonStr: d.afternoon > 0 ? formatLiters(d.afternoon) : '—',
        eveningStr: d.evening > 0 ? formatLiters(d.evening) : '—',
        totalStr: formatLiters(d.total),
        calvesStr: formatLiters(d.calves),
        netStr: formatLiters(d.net),
        revenueStr: formatUGX(d.revenue)
      }))
      rows.push({
        dayName: 'MONTH TOTAL',
        formattedDate: `${cowMonthSummary.daysMilked} days recorded`,
        morningStr: formatLiters(cowMonthSummary.morning),
        afternoonStr: formatLiters(cowMonthSummary.afternoon),
        eveningStr: formatLiters(cowMonthSummary.evening),
        totalStr: formatLiters(cowMonthSummary.total),
        calvesStr: formatLiters(cowMonthSummary.calves),
        netStr: formatLiters(cowMonthSummary.net),
        revenueStr: formatUGX(cowMonthSummary.revenue)
      })
      const title = `Monthly Milk Report - ${targetMonthlyCow.name || 'Cow'} (${targetMonthlyCow.tagNumber}) - ${monthTitle}`
      exportToPDF({ title, columns, rows, filename: `Monthly_Milk_${(targetMonthlyCow.name || 'Cow').replace(/\s+/g, '_')}_${targetMonthlyCow.tagNumber}_${format(monthStart, 'yyyyMM')}` })
    } else {
      const columns = [
        { key: 'tagNumber', header: 'Tag ID' },
        { key: 'animalName', header: 'Cow Name' },
        { key: 'breed', header: 'Breed' },
        { key: 'daysMilkedStr', header: 'Days Milked' },
        { key: 'morningStr', header: 'Morning (L)' },
        { key: 'afternoonStr', header: 'Afternoon (L)' },
        { key: 'eveningStr', header: 'Evening (L)' },
        { key: 'totalStr', header: 'Month Total (L)' },
        { key: 'calvesStr', header: 'To Calves (L)' },
        { key: 'netStr', header: 'Net Sold (L)' },
        { key: 'revenueStr', header: 'Revenue (UGX)' }
      ]
      const rows = allCowsMonthly.map(c => ({
        tagNumber: c.tagNumber,
        animalName: c.animalName,
        breed: c.breed,
        daysMilkedStr: `${c.daysMilked} days`,
        morningStr: formatLiters(c.morning),
        afternoonStr: formatLiters(c.afternoon),
        eveningStr: formatLiters(c.evening),
        totalStr: formatLiters(c.total),
        calvesStr: formatLiters(c.calves),
        netStr: formatLiters(c.net),
        revenueStr: formatUGX(c.revenue)
      }))
      rows.push({
        tagNumber: 'ALL COWS TOTAL',
        animalName: `${allCowsMonthly.length} Cows`,
        breed: 'Grand Total',
        daysMilkedStr: `${monthTitle}`,
        morningStr: formatLiters(allCowsMonthly.reduce((s, c) => s + c.morning, 0)),
        afternoonStr: formatLiters(allCowsMonthly.reduce((s, c) => s + c.afternoon, 0)),
        eveningStr: formatLiters(allCowsMonthly.reduce((s, c) => s + c.evening, 0)),
        totalStr: formatLiters(monthTotalExtracted),
        calvesStr: formatLiters(monthTotalCalves),
        netStr: formatLiters(monthTotalNet),
        revenueStr: formatUGX(monthTotalRevenue)
      })
      const title = `Monthly Milk Production Report (By Cow) - ${monthTitle}`
      exportToPDF({ title, columns, rows, filename: `Monthly_Milk_By_Cow_${format(monthStart, 'yyyyMM')}` })
    }
  }

  const handleMonthlyExportExcel = () => {
    if (monthlyCowFilter !== 'all' && targetMonthlyCow) {
      const columns = [
        { key: 'dayName', header: 'Day' },
        { key: 'formattedDate', header: 'Date' },
        { key: 'morningStr', header: 'Morning (L)' },
        { key: 'afternoonStr', header: 'Afternoon (L)' },
        { key: 'eveningStr', header: 'Evening (L)' },
        { key: 'totalStr', header: 'Total (L)' },
        { key: 'calvesStr', header: 'To Calves (L)' },
        { key: 'netStr', header: 'Net Sold (L)' },
        { key: 'revenueStr', header: 'Revenue (UGX)' }
      ]
      const rows = cowMonthDays.map(d => ({
        dayName: d.dayName,
        formattedDate: d.formattedDate,
        morningStr: d.morning,
        afternoonStr: d.afternoon,
        eveningStr: d.evening,
        totalStr: d.total,
        calvesStr: d.calves,
        netStr: d.net,
        revenueStr: d.revenue
      }))
      rows.push({
        dayName: 'MONTH TOTAL',
        formattedDate: `${cowMonthSummary.daysMilked} days recorded`,
        morningStr: cowMonthSummary.morning,
        afternoonStr: cowMonthSummary.afternoon,
        eveningStr: cowMonthSummary.evening,
        totalStr: cowMonthSummary.total,
        calvesStr: cowMonthSummary.calves,
        netStr: cowMonthSummary.net,
        revenueStr: cowMonthSummary.revenue
      })
      const title = `Monthly Milk - ${targetMonthlyCow.name || 'Cow'} (${targetMonthlyCow.tagNumber})`
      exportToExcel({ title, columns, rows, filename: `Monthly_Milk_${(targetMonthlyCow.name || 'Cow').replace(/\s+/g, '_')}_${targetMonthlyCow.tagNumber}_${format(monthStart, 'yyyyMM')}` })
    } else {
      const columns = [
        { key: 'tagNumber', header: 'Tag ID' },
        { key: 'animalName', header: 'Cow Name' },
        { key: 'breed', header: 'Breed' },
        { key: 'daysMilkedStr', header: 'Days Milked' },
        { key: 'morningStr', header: 'Morning (L)' },
        { key: 'afternoonStr', header: 'Afternoon (L)' },
        { key: 'eveningStr', header: 'Evening (L)' },
        { key: 'totalStr', header: 'Month Total (L)' },
        { key: 'calvesStr', header: 'To Calves (L)' },
        { key: 'netStr', header: 'Net Sold (L)' },
        { key: 'revenueStr', header: 'Revenue (UGX)' }
      ]
      const rows = allCowsMonthly.map(c => ({
        tagNumber: c.tagNumber,
        animalName: c.animalName,
        breed: c.breed,
        daysMilkedStr: c.daysMilked,
        morningStr: c.morning,
        afternoonStr: c.afternoon,
        eveningStr: c.evening,
        totalStr: c.total,
        calvesStr: c.calves,
        netStr: c.net,
        revenueStr: c.revenue
      }))
      rows.push({
        tagNumber: 'ALL COWS TOTAL',
        animalName: `${allCowsMonthly.length} Cows`,
        breed: 'Grand Total',
        daysMilkedStr: monthTitle,
        morningStr: allCowsMonthly.reduce((s, c) => s + c.morning, 0),
        afternoonStr: allCowsMonthly.reduce((s, c) => s + c.afternoon, 0),
        eveningStr: allCowsMonthly.reduce((s, c) => s + c.evening, 0),
        totalStr: monthTotalExtracted,
        calvesStr: monthTotalCalves,
        netStr: monthTotalNet,
        revenueStr: monthTotalRevenue
      })
      const title = `Monthly Milk (By Cow) - ${monthTitle}`
      exportToExcel({ title, columns, rows, filename: `Monthly_Milk_By_Cow_${format(monthStart, 'yyyyMM')}` })
    }
  }

  const handleWeeklyPrint = () => {
    document.body.setAttribute('data-print-title', `Weekly Milk Report (${format(weekStart, 'dd MMM')} - ${format(weekEnd, 'dd MMM yyyy')})`)
    window.print()
  }

  // ─── Modal & Form Handlers ──────────────────────────────────────────────────
  const editRowRecord = (row, focusSession = 'morning') => {
    setEditingRow(row)
    setEditingRecord(null)
    setFormData({
      animalId: row.animalId,
      tagNumber: row.tagNumber,
      animalName: row.animalName,
      date: selectedDateFilter,
      morning: row.Morning > 0 ? String(row.Morning) : '',
      afternoon: row.Afternoon > 0 ? String(row.Afternoon) : '',
      evening: row.Evening > 0 ? String(row.Evening) : '',
      calvesAmount: row.calvesAmount > 0 ? String(row.calvesAmount) : '',
      focusSession
    })
    setIsModalOpen(true)
  }

  const editSessionRecord = (row, session) => {
    editRowRecord(row, session.toLowerCase())
  }

  const selectCowForYield = (c) => {
    const targetDate = formData.date || selectedDateFilter
    const existingMorning = records.find(r => String(r.animalId) === String(c.id) && r.date === targetDate && r.session === 'Morning')
    const existingAfternoon = records.find(r => String(r.animalId) === String(c.id) && r.date === targetDate && r.session === 'Afternoon')
    const existingEvening = records.find(r => String(r.animalId) === String(c.id) && r.date === targetDate && r.session === 'Evening')
    const totalCalves = (existingMorning?.calvesAmount || 0) + (existingAfternoon?.calvesAmount || 0) + (existingEvening?.calvesAmount || 0)

    setFormData({
      ...formData,
      animalId: c.id,
      morning: existingMorning?.amount ? String(existingMorning.amount) : '',
      afternoon: existingAfternoon?.amount ? String(existingAfternoon.amount) : '',
      evening: existingEvening?.amount ? String(existingEvening.amount) : '',
      calvesAmount: totalCalves > 0 ? String(totalCalves) : ''
    })
    setCowTypeQuery('')
  }

  const handleDateChangeInModal = (newDate) => {
    if (!formData.animalId) {
      setFormData({ ...formData, date: newDate })
      return
    }
    const existingMorning = records.find(r => String(r.animalId) === String(formData.animalId) && r.date === newDate && r.session === 'Morning')
    const existingAfternoon = records.find(r => String(r.animalId) === String(formData.animalId) && r.date === newDate && r.session === 'Afternoon')
    const existingEvening = records.find(r => String(r.animalId) === String(formData.animalId) && r.date === newDate && r.session === 'Evening')
    const totalCalves = (existingMorning?.calvesAmount || 0) + (existingAfternoon?.calvesAmount || 0) + (existingEvening?.calvesAmount || 0)

    setFormData({
      ...formData,
      date: newDate,
      morning: existingMorning?.amount ? String(existingMorning.amount) : '',
      afternoon: existingAfternoon?.amount ? String(existingAfternoon.amount) : '',
      evening: existingEvening?.amount ? String(existingEvening.amount) : '',
      calvesAmount: totalCalves > 0 ? String(totalCalves) : ''
    })
  }

  const SessionCell = ({ val, row, session }) => {
    if (val > 0) {
      return (
        <button 
          type="button"
          onClick={() => editSessionRecord(row, session)} 
          className="text-white font-medium hover:text-emerald-400 px-2 py-1 -mx-2 rounded hover:bg-white/10 transition-all flex items-center gap-1.5 group text-left cursor-pointer"
          title={`Click to edit ${session} milking time (${formatLiters(val)})`}
        >
          <span>{formatLiters(val)}</span>
          <Edit2 size={11} className="opacity-0 group-hover:opacity-100 text-emerald-400 transition-opacity" />
        </button>
      )
    }
    return (
      <button 
        type="button"
        onClick={() => editSessionRecord(row, session)} 
        className="text-xs text-slate-500 hover:text-white px-2 py-1 rounded hover:bg-white/10 transition-colors flex items-center gap-1"
        title={`Add ${session} yield`}
      >
        <Plus size={12} /> Add
      </button>
    )
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!formData.animalId) {
      alert('Please select a cow by typing its name or tag')
      return
    }
    const cow = unifiedCows.find(a => String(a.id) === String(formData.animalId)) || animals.find(a => String(a.id) === String(formData.animalId))
    const tagNumber = cow?.tagNumber || formData.tagNumber || ''
    const animalName = cow?.name || formData.animalName || 'Cow'
    const targetDate = formData.date || selectedDateFilter

    const sessionInputs = [
      { session: 'Morning', val: Number(formData.morning) || 0 },
      { session: 'Afternoon', val: Number(formData.afternoon) || 0 },
      { session: 'Evening', val: Number(formData.evening) || 0 }
    ]

    const totalCalves = Number(formData.calvesAmount) || 0

    // Filter existing records for this cow on this date
    const cowDateRecords = records.filter(r => String(r.animalId) === String(formData.animalId) && r.date === targetDate)

    let calvesAssigned = false
    for (const item of sessionInputs) {
      const existing = cowDateRecords.filter(r => r.session === item.session)
      const calvesForThis = !calvesAssigned && item.val > 0 ? totalCalves : 0
      if (item.val > 0) calvesAssigned = true

      if (item.val > 0) {
        if (existing.length > 0) {
          // Update primary existing record with correct amount
          await updateRecord(existing[0].id, {
            amount: item.val,
            calvesAmount: calvesForThis,
            animalId: formData.animalId,
            tagNumber,
            animalName,
            date: targetDate,
            session: item.session
          })
          // Clean up any extra duplicate records from past accidental double-entries
          for (let i = 1; i < existing.length; i++) {
            await deleteRecord(existing[i].id)
          }
        } else {
          // Add new record for this session
          await addRecord({
            animalId: formData.animalId,
            tagNumber,
            animalName,
            date: targetDate,
            session: item.session,
            amount: item.val,
            calvesAmount: calvesForThis
          })
        }
      } else {
        // If amount was cleared or set to 0, clean up any existing records for that session
        for (const r of existing) {
          await deleteRecord(r.id)
        }
      }
    }

    setIsModalOpen(false)
    setEditingRecord(null)
    setEditingRow(null)
    setFormData(initialForm)
    setCowTypeQuery('')
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

  const openNameModal = () => {
    const map = {}
    previousCows.forEach(c => {
      map[c.id] = {
        name: historicalNames[c.id]?.name || (c.name?.startsWith('Previous Cow') ? '' : c.name) || '',
        tagNumber: historicalNames[c.id]?.tagNumber || (c.tagNumber?.startsWith('OLD-') ? '' : c.tagNumber) || ''
      }
    })
    setEditHistoricalMap(map)
    setIsNameModalOpen(true)
  }

  const handleSaveHistoricalNames = async () => {
    try {
      const updated = await saveHistoricalCowNames(editHistoricalMap)
      setHistoricalNames(updated)
      await loadRecords()
      setIsNameModalOpen(false)
      alert('Saved successfully! Previous cows now have their names updated across all records.')
    } catch (e) {
      alert('Failed to save cow names: ' + e.message)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="page-title">Milk Production</h1>
          <p className="text-slate-400 text-sm mt-1">Track daily milking sessions, calves consumption, and weekly reports.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Herd Filter Toggle */}
          <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 text-xs">
            <button
              onClick={() => setHerdFilter('all')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${herdFilter === 'all' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
              title="Show all cows (active and previous)"
            >
              All Cows
            </button>
            <button
              onClick={() => setHerdFilter('active')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${herdFilter === 'active' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
              title="Show only currently active herd"
            >
              Active Herd ({activeCows.length})
            </button>
            <button
              onClick={() => setHerdFilter('previous')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${herdFilter === 'previous' ? 'bg-amber-500 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
              title="Show only previous herd (deleted cows with milk records)"
            >
              Previous Herd ({previousCows.length})
            </button>
          </div>

          {previousCows.length > 0 && (
            <button
              onClick={openNameModal}
              className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5 border border-amber-500/30 text-amber-300 hover:bg-amber-500/10 font-semibold"
              title="Identify or name the previous deleted cows"
            >
              <Tag size={13} /> Name Previous Cows
            </button>
          )}

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
            <button
              onClick={() => setViewMode('monthly')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${viewMode === 'monthly' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              <FileText size={14} /> Monthly Report
            </button>
          </div>

          {viewMode === 'daily' && (
            <>
              <input 
                 type="date" 
                 className="input-field bg-white/5 border-white/10 text-xs py-1.5 px-3" 
                 value={selectedDateFilter}
                 onChange={e => setSelectedDateFilter(e.target.value)}
                 title="Select Date"
                 required
              />
              <button className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1.5" onClick={() => { setEditingRow(null); setEditingRecord(null); setFormData({ ...initialForm, date: selectedDateFilter }); setIsModalOpen(true) }}>
                <Plus size={16} /> Add Yield
              </button>
            </>
          )}

          {viewMode === 'weekly' && (
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

          {viewMode === 'monthly' && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedMonthFilter(format(subMonths(monthStart, 1), 'yyyy-MM'))}
                className="btn-secondary py-1.5 px-2 text-xs"
                title="Previous Month"
              >
                <ChevronLeft size={16} />
              </button>
              <input 
                 type="month" 
                 className="input-field bg-white/5 border-white/10 text-xs py-1.5 px-3" 
                 value={selectedMonthFilter}
                 onChange={e => setSelectedMonthFilter(e.target.value || format(new Date(), 'yyyy-MM'))}
                 title="Select Month"
                 required
              />
              <button
                onClick={() => setSelectedMonthFilter(format(addMonths(monthStart, 1), 'yyyy-MM'))}
                className="btn-secondary py-1.5 px-2 text-xs"
                title="Next Month"
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
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 pb-3 border-b border-white/10">
              <div>
                <h3 className="text-xl font-display font-semibold text-white">
                  {selectedDateFilter ? format(new Date(selectedDateFilter), 'EEEE, dd MMMM yyyy') : 'All Dates'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Showing records for {filteredDailyData.length} cow(s)</p>
              </div>

              {/* Milk Records Search Bar */}
              <div className="search-bar w-full sm:w-80">
                <Search size={16} className="text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Search cow name or tag (e.g. Bella)..." 
                  className="bg-transparent border-none outline-none w-full text-white placeholder:text-slate-500 text-xs" 
                  value={milkSearchQuery} 
                  onChange={(e) => setMilkSearchQuery(e.target.value)} 
                />
                {milkSearchQuery && (
                  <button type="button" onClick={() => setMilkSearchQuery('')} className="text-slate-400 hover:text-white">
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            <DataTable 
              columns={columns} 
              data={filteredDailyData} 
              pageSize={15} 
              emptyMessage={milkSearchQuery ? `No cows found matching "${milkSearchQuery}"` : `No records for ${selectedDateFilter ? format(new Date(selectedDateFilter), 'dd MMM yyyy') : 'selected date'}`} 
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
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 pb-4 border-b border-white/10">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>🥛 Weekly Milk Production Report</span>
                  {weeklyCowFilter !== 'all' && targetWeeklyCow && (
                    <span className="text-xs font-normal px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      {targetWeeklyCow.name} ({targetWeeklyCow.tagNumber})
                    </span>
                  )}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Breakdown for <span className="text-emerald-400 font-semibold">{format(weekStart, 'EEEE, dd MMMM')}</span> to <span className="text-emerald-400 font-semibold">{format(weekEnd, 'EEEE, dd MMMM yyyy')}</span>
                </p>
              </div>

              {/* Weekly Action Controls */}
              <div className="flex flex-wrap items-center gap-2 print:hidden">
                {/* Cow Filter */}
                <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-xl px-2.5 py-1 text-xs">
                  <Beef size={14} className="text-emerald-400" />
                  <span className="text-slate-400">Cow:</span>
                  <select
                    value={weeklyCowFilter}
                    onChange={e => setWeeklyCowFilter(e.target.value)}
                    className="bg-transparent text-white outline-none cursor-pointer text-xs"
                  >
                    <option value="all" className="bg-slate-900 text-white">All Cows (Weekly Summary)</option>
                    <optgroup label="Active Herd (Current Cows)">
                      {activeCows.map(c => (
                        <option key={c.id} value={c.id} className="bg-slate-900 text-white">
                          {c.name || 'Unnamed'} ({c.tagNumber})
                        </option>
                      ))}
                    </optgroup>
                    {previousCows.length > 0 && (
                      <optgroup label="Previous Herd (Historical Records)">
                        {previousCows.map(c => (
                          <option key={c.id} value={c.id} className="bg-slate-900 text-amber-300">
                            {c.name || 'Unnamed'} ({c.tagNumber})
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>

                {weeklyCowFilter === 'all' && (
                  <div className="flex bg-white/5 p-0.5 rounded-lg border border-white/10 text-xs">
                    <button
                      onClick={() => setWeeklyViewType('days')}
                      className={`px-2.5 py-1 rounded text-xs transition-colors ${weeklyViewType === 'days' ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                      Daily Breakdown
                    </button>
                    <button
                      onClick={() => setWeeklyViewType('cows')}
                      className={`px-2.5 py-1 rounded text-xs transition-colors ${weeklyViewType === 'cows' ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                      By Cow
                    </button>
                  </div>
                )}

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
              </div>
            </div>

            {/* Weekly Table (Cow or All Cows) */}
            {weeklyCowFilter !== 'all' && targetWeeklyCow ? (
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
                        className={`hover:bg-white/5 transition-colors ${day.total > 0 ? 'text-white' : 'text-slate-500'}`}
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
                      <td className="p-3 text-emerald-400" colSpan={2}>WEEK TOTALS ({targetWeeklyCow.name})</td>
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
            ) : weeklyViewType === 'cows' ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-400 uppercase text-[10px] tracking-wider bg-white/5">
                      <th className="p-3">#</th>
                      <th className="p-3">Cow</th>
                      <th className="p-3">Breed</th>
                      <th className="p-3 text-right">Morning</th>
                      <th className="p-3 text-right">Afternoon</th>
                      <th className="p-3 text-right">Evening</th>
                      <th className="p-3 text-right">Week Total</th>
                      <th className="p-3 text-right">Given to Calves</th>
                      <th className="p-3 text-right">Net Remained</th>
                      <th className="p-3 text-right">Weekly Revenue</th>
                      <th className="p-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {allCowsWeekly.map((cow, idx) => (
                      <tr 
                        key={cow.id} 
                        className={`hover:bg-white/5 transition-colors cursor-pointer ${cow.total > 0 ? 'text-white' : 'text-slate-500'}`}
                        onClick={() => setWeeklyCowFilter(cow.id)}
                        title="Click to view weekly breakdown for this cow"
                      >
                        <td className="p-3 font-mono text-slate-500">{idx + 1}</td>
                        <td className="p-3">
                          <p className="font-semibold text-white">{cow.tagNumber}</p>
                          <p className="text-xs text-emerald-400">{cow.animalName}</p>
                        </td>
                        <td className="p-3 text-slate-400">{cow.breed}</td>
                        <td className="p-3 text-right font-mono">{cow.morning > 0 ? formatLiters(cow.morning) : '—'}</td>
                        <td className="p-3 text-right font-mono">{cow.afternoon > 0 ? formatLiters(cow.afternoon) : '—'}</td>
                        <td className="p-3 text-right font-mono">{cow.evening > 0 ? formatLiters(cow.evening) : '—'}</td>
                        <td className="p-3 text-right font-mono font-bold text-blue-400">{cow.total > 0 ? formatLiters(cow.total) : '0 L'}</td>
                        <td className="p-3 text-right font-mono text-rose-400">{cow.calves > 0 ? formatLiters(cow.calves) : '0 L'}</td>
                        <td className="p-3 text-right font-mono font-bold text-teal-400">{cow.net > 0 ? formatLiters(cow.net) : '0 L'}</td>
                        <td className="p-3 text-right font-mono font-bold text-emerald-400">{cow.revenue > 0 ? formatUGX(cow.revenue) : 'UGX 0'}</td>
                        <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => setWeeklyCowFilter(cow.id)}
                            className="btn-secondary px-2.5 py-1 text-[11px] text-emerald-400 hover:text-white"
                          >
                            View Days →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-emerald-500/50 bg-emerald-500/10 font-bold text-white text-sm">
                      <td className="p-3 text-emerald-400" colSpan={3}>WEEK TOTALS ({allCowsWeekly.length} cows)</td>
                      <td className="p-3 text-right font-mono text-xs">{formatLiters(allCowsWeekly.reduce((s, c) => s + c.morning, 0))}</td>
                      <td className="p-3 text-right font-mono text-xs">{formatLiters(allCowsWeekly.reduce((s, c) => s + c.afternoon, 0))}</td>
                      <td className="p-3 text-right font-mono text-xs">{formatLiters(allCowsWeekly.reduce((s, c) => s + c.evening, 0))}</td>
                      <td className="p-3 text-right font-mono text-blue-400">{formatLiters(allCowsWeekly.reduce((s, c) => s + c.total, 0))}</td>
                      <td className="p-3 text-right font-mono text-rose-400">{formatLiters(allCowsWeekly.reduce((s, c) => s + c.calves, 0))}</td>
                      <td className="p-3 text-right font-mono text-teal-400">{formatLiters(allCowsWeekly.reduce((s, c) => s + c.net, 0))}</td>
                      <td className="p-3 text-right font-mono text-emerald-400">{formatUGX(allCowsWeekly.reduce((s, c) => s + c.revenue, 0))}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
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
            )}
          </div>
        </div>
      )}

      {/* ─── MONTHLY REPORT VIEW ──────────────────────────────────────────────── */}
      {viewMode === 'monthly' && (
        <div className="space-y-6">
          {/* Monthly Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="glass-card p-4 border-l-4 border-l-blue-500">
              <p className="text-xs text-slate-400">Month Total Extracted</p>
              <p className="text-2xl font-display font-bold text-white mt-1">
                {monthlyCowFilter !== 'all' ? formatLiters(cowMonthSummary.total) : formatLiters(monthTotalExtracted)}
              </p>
              <p className="text-[10px] text-slate-500 mt-1">{monthTitle}</p>
            </div>
            <div className="glass-card p-4 border-l-4 border-l-amber-500">
              <p className="text-xs text-slate-400">Daily Average</p>
              <p className="text-2xl font-display font-bold text-white mt-1">
                {monthlyCowFilter !== 'all' 
                  ? (cowMonthSummary.daysMilked > 0 ? formatLiters(cowMonthSummary.total / cowMonthSummary.daysMilked) : '0.0 L')
                  : `${monthDailyAvg} L`}
              </p>
              <p className="text-[10px] text-slate-500 mt-1">Per Active Day</p>
            </div>
            <div className="glass-card p-4 border-l-4 border-l-rose-500">
              <p className="text-xs text-slate-400">Given to Calves</p>
              <p className="text-2xl font-display font-bold text-white mt-1">
                {monthlyCowFilter !== 'all' ? formatLiters(cowMonthSummary.calves) : formatLiters(monthTotalCalves)}
              </p>
              <p className="text-[10px] text-slate-500 mt-1">Calf Feeding Total</p>
            </div>
            <div className="glass-card p-4 border-l-4 border-l-teal-500">
              <p className="text-xs text-slate-400">Net Remained</p>
              <p className="text-2xl font-display font-bold text-white mt-1">
                {monthlyCowFilter !== 'all' ? formatLiters(cowMonthSummary.net) : formatLiters(monthTotalNet)}
              </p>
              <p className="text-[10px] text-slate-500 mt-1">Sold Milk</p>
            </div>
            <div className="glass-card p-4 border-l-4 border-l-emerald-500 col-span-2 md:col-span-1">
              <p className="text-xs text-slate-400">Estimated Revenue</p>
              <p className="text-2xl font-display font-bold text-emerald-400 mt-1">
                {monthlyCowFilter !== 'all' ? formatUGX(cowMonthSummary.revenue) : formatUGX(monthTotalRevenue)}
              </p>
              <p className="text-[10px] text-slate-500 mt-1">At UGX 1,500 / L</p>
            </div>
          </div>

          {/* Monthly Table Card */}
          <div className="glass-card p-5 space-y-4">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 pb-4 border-b border-white/10">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>🗓️ Monthly Milk Production Report</span>
                  {monthlyCowFilter !== 'all' && targetMonthlyCow && (
                    <span className="text-xs font-normal px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      {targetMonthlyCow.name} ({targetMonthlyCow.tagNumber})
                    </span>
                  )}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Showing monthly performance for <span className="text-emerald-400 font-semibold">{monthTitle}</span>
                </p>
              </div>

              {/* Monthly Action Controls */}
              <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                {/* Cow Selector Filter */}
                <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-xl px-2.5 py-1 text-xs">
                  <Beef size={14} className="text-emerald-400" />
                  <span className="text-slate-400">Cow:</span>
                  <select
                    value={monthlyCowFilter}
                    onChange={e => setMonthlyCowFilter(e.target.value)}
                    className="bg-transparent text-white outline-none cursor-pointer text-xs"
                  >
                    <option value="all" className="bg-slate-900 text-white">All Cows (Monthly Performance)</option>
                    <optgroup label="Active Herd (Current Cows)">
                      {activeCows.map(c => (
                        <option key={c.id} value={c.id} className="bg-slate-900 text-white">
                          {c.name || 'Unnamed'} ({c.tagNumber})
                        </option>
                      ))}
                    </optgroup>
                    {previousCows.length > 0 && (
                      <optgroup label="Previous Herd (Historical Records)">
                        {previousCows.map(c => (
                          <option key={c.id} value={c.id} className="bg-slate-900 text-amber-300">
                            {c.name || 'Unnamed'} ({c.tagNumber})
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>

                {monthlyCowFilter === 'all' && (
                  <div className="search-bar py-1 px-2.5 text-xs w-full sm:w-48">
                    <Search size={14} className="text-slate-400" />
                    <input
                      type="text"
                      placeholder="Filter cow..."
                      className="bg-transparent border-none outline-none w-full text-white placeholder:text-slate-500 text-xs"
                      value={monthlySearchQuery}
                      onChange={e => setMonthlySearchQuery(e.target.value)}
                    />
                    {monthlySearchQuery && (
                      <button onClick={() => setMonthlySearchQuery('')} className="text-slate-400 hover:text-white">
                        <X size={12} />
                      </button>
                    )}
                  </div>
                )}

                {/* PDF & Excel Export Buttons */}
                <button
                  onClick={handleMonthlyExportPDF}
                  className="btn-secondary text-xs flex items-center gap-1.5 py-1.5 px-3"
                  title="Export Monthly PDF"
                >
                  <FileText size={14} className="text-red-400" /> PDF
                </button>
                <button
                  onClick={handleMonthlyExportExcel}
                  className="btn-secondary text-xs flex items-center gap-1.5 py-1.5 px-3"
                  title="Export Monthly Excel"
                >
                  <FileSpreadsheet size={14} className="text-green-400" /> Excel
                </button>
              </div>
            </div>

            {/* Table Content: Specific Cow (Day-by-Day) OR All Cows (Ranking / Summary) */}
            {monthlyCowFilter !== 'all' && targetMonthlyCow ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-400 uppercase text-[10px] tracking-wider bg-white/5">
                      <th className="p-3">Date</th>
                      <th className="p-3">Day</th>
                      <th className="p-3 text-right">Morning</th>
                      <th className="p-3 text-right">Afternoon</th>
                      <th className="p-3 text-right">Evening</th>
                      <th className="p-3 text-right">Total Yield</th>
                      <th className="p-3 text-right">Given to Calves</th>
                      <th className="p-3 text-right">Net Remained</th>
                      <th className="p-3 text-right">Daily Revenue</th>
                      <th className="p-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {cowMonthDays.map(day => (
                      <tr key={day.date} className={`hover:bg-white/5 transition-colors ${day.total > 0 ? 'text-white' : 'text-slate-500'}`}>
                        <td className="p-3 font-semibold text-white">{day.formattedDate}</td>
                        <td className="p-3 text-slate-400">{day.dayName}</td>
                        <td className="p-3 text-right font-mono">{day.morning > 0 ? formatLiters(day.morning) : '—'}</td>
                        <td className="p-3 text-right font-mono">{day.afternoon > 0 ? formatLiters(day.afternoon) : '—'}</td>
                        <td className="p-3 text-right font-mono">{day.evening > 0 ? formatLiters(day.evening) : '—'}</td>
                        <td className="p-3 text-right font-mono font-bold text-blue-400">{day.total > 0 ? formatLiters(day.total) : '0 L'}</td>
                        <td className="p-3 text-right font-mono text-rose-400">{day.calves > 0 ? formatLiters(day.calves) : '0 L'}</td>
                        <td className="p-3 text-right font-mono font-bold text-teal-400">{day.net > 0 ? formatLiters(day.net) : '0 L'}</td>
                        <td className="p-3 text-right font-mono font-bold text-emerald-400">{day.revenue > 0 ? formatUGX(day.revenue) : 'UGX 0'}</td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => {
                              setSelectedDateFilter(day.date)
                              setEditingRow({ animalId: targetMonthlyCow.id, tagNumber: targetMonthlyCow.tagNumber, animalName: targetMonthlyCow.name, records: day.records })
                              const firstRec = Object.values(day.records)[0]
                              if (firstRec) {
                                setEditingRecord(firstRec)
                                setFormData({
                                  animalId: targetMonthlyCow.id,
                                  date: day.date,
                                  session: firstRec.session,
                                  amount: String(firstRec.amount),
                                  calvesAmount: String(firstRec.calvesAmount || '')
                                })
                              } else {
                                setEditingRecord(null)
                                setFormData({
                                  animalId: targetMonthlyCow.id,
                                  date: day.date,
                                  session: 'Morning',
                                  amount: '',
                                  calvesAmount: ''
                                })
                              }
                              setIsModalOpen(true)
                            }}
                            className="btn-secondary px-2.5 py-1 text-[11px] inline-flex items-center gap-1 text-slate-300 hover:text-white"
                          >
                            <Edit2 size={12} /> {day.total > 0 ? 'Edit' : 'Add'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-emerald-500/50 bg-emerald-500/10 font-bold text-white text-sm">
                      <td className="p-3 text-emerald-400" colSpan={2}>
                        MONTH TOTALS ({cowMonthSummary.daysMilked} days milked)
                      </td>
                      <td className="p-3 text-right font-mono text-xs">{formatLiters(cowMonthSummary.morning)}</td>
                      <td className="p-3 text-right font-mono text-xs">{formatLiters(cowMonthSummary.afternoon)}</td>
                      <td className="p-3 text-right font-mono text-xs">{formatLiters(cowMonthSummary.evening)}</td>
                      <td className="p-3 text-right font-mono text-blue-400">{formatLiters(cowMonthSummary.total)}</td>
                      <td className="p-3 text-right font-mono text-rose-400">{formatLiters(cowMonthSummary.calves)}</td>
                      <td className="p-3 text-right font-mono text-teal-400">{formatLiters(cowMonthSummary.net)}</td>
                      <td className="p-3 text-right font-mono text-emerald-400">{formatUGX(cowMonthSummary.revenue)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-400 uppercase text-[10px] tracking-wider bg-white/5">
                      <th className="p-3">#</th>
                      <th className="p-3">Cow</th>
                      <th className="p-3">Breed</th>
                      <th className="p-3 text-center">Days Milked</th>
                      <th className="p-3 text-right">Morning</th>
                      <th className="p-3 text-right">Afternoon</th>
                      <th className="p-3 text-right">Evening</th>
                      <th className="p-3 text-right">Month Total</th>
                      <th className="p-3 text-right">To Calves</th>
                      <th className="p-3 text-right">Net Remained</th>
                      <th className="p-3 text-right">Month Revenue</th>
                      <th className="p-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredMonthlyCows.length === 0 ? (
                      <tr>
                        <td colSpan={12} className="p-8 text-center text-slate-500">
                          No cows found matching your criteria for {monthTitle}.
                        </td>
                      </tr>
                    ) : (
                      filteredMonthlyCows.map((cow, idx) => (
                        <tr
                          key={cow.id}
                          className={`hover:bg-white/5 transition-colors cursor-pointer ${cow.total > 0 ? 'text-white' : 'text-slate-500'}`}
                          onClick={() => setMonthlyCowFilter(cow.id)}
                          title="Click to view full monthly day-by-day record"
                        >
                          <td className="p-3 font-mono text-slate-500">{idx + 1}</td>
                          <td className="p-3">
                            <div className="flex items-center gap-1.5">
                              <p className="font-semibold text-white">{cow.tagNumber}</p>
                              {cow.isHistorical && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-medium">
                                  Previous
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-emerald-400">{cow.animalName}</p>
                          </td>
                          <td className="p-3 text-slate-400">{cow.breed}</td>
                          <td className="p-3 text-center">
                            <span className="px-2 py-0.5 rounded-full bg-white/10 font-mono text-[11px] text-slate-300">
                              {cow.daysMilked} d
                            </span>
                          </td>
                          <td className="p-3 text-right font-mono">{cow.morning > 0 ? formatLiters(cow.morning) : '—'}</td>
                          <td className="p-3 text-right font-mono">{cow.afternoon > 0 ? formatLiters(cow.afternoon) : '—'}</td>
                          <td className="p-3 text-right font-mono">{cow.evening > 0 ? formatLiters(cow.evening) : '—'}</td>
                          <td className="p-3 text-right font-mono font-bold text-blue-400">{cow.total > 0 ? formatLiters(cow.total) : '0 L'}</td>
                          <td className="p-3 text-right font-mono text-rose-400">{cow.calves > 0 ? formatLiters(cow.calves) : '0 L'}</td>
                          <td className="p-3 text-right font-mono font-bold text-teal-400">{cow.net > 0 ? formatLiters(cow.net) : '0 L'}</td>
                          <td className="p-3 text-right font-mono font-bold text-emerald-400">{cow.revenue > 0 ? formatUGX(cow.revenue) : 'UGX 0'}</td>
                          <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => setMonthlyCowFilter(cow.id)}
                              className="btn-secondary px-2.5 py-1 text-[11px] text-emerald-400 hover:text-white"
                            >
                              View Days →
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-emerald-500/50 bg-emerald-500/10 font-bold text-white text-sm">
                      <td className="p-3 text-emerald-400" colSpan={4}>
                        ALL COWS MONTH TOTAL ({allCowsMonthly.length} cows)
                      </td>
                      <td className="p-3 text-right font-mono text-xs">{formatLiters(allCowsMonthly.reduce((s, c) => s + c.morning, 0))}</td>
                      <td className="p-3 text-right font-mono text-xs">{formatLiters(allCowsMonthly.reduce((s, c) => s + c.afternoon, 0))}</td>
                      <td className="p-3 text-right font-mono text-xs">{formatLiters(allCowsMonthly.reduce((s, c) => s + c.evening, 0))}</td>
                      <td className="p-3 text-right font-mono text-blue-400">{formatLiters(monthTotalExtracted)}</td>
                      <td className="p-3 text-right font-mono text-rose-400">{formatLiters(monthTotalCalves)}</td>
                      <td className="p-3 text-right font-mono text-teal-400">{formatLiters(monthTotalNet)}</td>
                      <td className="p-3 text-right font-mono text-emerald-400">{formatUGX(monthTotalRevenue)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal for adding / editing yield */}
      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingRecord(null); setEditingRow(null); setFormData(initialForm) }} title={editingRow && formData.animalId ? `Edit Milk Yield: ${editingRow.tagNumber} (${editingRow.animalName})` : formData.animalId ? `Record Milk Yield: ${selectedCowObj?.tagNumber || ''} (${selectedCowObj?.name || 'Cow'})` : "Add Milk Yield"}>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-400 mb-1">Cow *</label>
              {editingRow ? (
                <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center border border-green-500/20 text-green-400">
                      <Beef size={16} />
                    </div>
                    <div>
                      <p className="font-semibold text-white text-sm">
                        {editingRow.tagNumber} — <span className="text-emerald-400">{editingRow.animalName}</span>
                      </p>
                      <p className="text-[10px] text-slate-400">Milking Cow Record</p>
                    </div>
                  </div>
                </div>
              ) : formData.animalId ? (
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-300">
                      <Beef size={16} />
                    </div>
                    <div>
                      <p className="font-semibold text-white text-sm">
                        {selectedCowObj?.tagNumber} — <span className="text-emerald-300 font-bold">{selectedCowObj?.name || 'Unnamed'}</span>
                      </p>
                      <p className="text-[10px] text-slate-400">{selectedCowObj?.breed}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setFormData({ ...formData, animalId: '', morning: '', afternoon: '', evening: '', calvesAmount: '' }); setCowTypeQuery('') }}
                    className="btn-secondary text-xs px-2.5 py-1 text-slate-300 hover:text-white"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="search-bar">
                    <Search size={16} className="text-slate-400" />
                    <input
                      type="text"
                      placeholder="Type cow name or tag (e.g. Bella or JBS-001)..."
                      className="bg-transparent border-none outline-none w-full text-white placeholder:text-slate-500 text-xs"
                      value={cowTypeQuery}
                      onChange={e => setCowTypeQuery(e.target.value)}
                      autoFocus
                    />
                    {cowTypeQuery && (
                      <button type="button" onClick={() => setCowTypeQuery('')} className="text-slate-400 hover:text-white">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  <div className="max-h-44 overflow-y-auto space-y-1 p-1 rounded-xl bg-slate-900/60 border border-white/10 divide-y divide-white/5">
                    {filteredCowsForSelect.length === 0 ? (
                      <p className="text-xs text-slate-500 py-3 text-center">No matching milking cows found</p>
                    ) : (
                      filteredCowsForSelect.map(c => (
                        <div
                          key={c.id}
                          onClick={() => selectCowForYield(c)}
                          className="flex items-center justify-between p-2 rounded-lg hover:bg-emerald-500/15 cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded bg-green-500/10 flex items-center justify-center text-green-400 flex-shrink-0">
                              <Beef size={13} />
                            </div>
                            <div>
                              <span className="font-semibold text-white text-xs mr-2">{c.tagNumber}</span>
                              <span className="text-emerald-400 font-bold text-xs">{c.name || 'Unnamed'}</span>
                              <span className="text-[10px] text-slate-500 ml-1.5">({c.breed})</span>
                            </div>
                          </div>
                          <span className="text-[10px] font-semibold text-emerald-400">Select →</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-400 mb-1">Date *</label>
              <input
                required
                type="date"
                className="input-field"
                value={formData.date}
                onChange={e => handleDateChangeInModal(e.target.value)}
              />
            </div>

            {formData.animalId && (
              <>
                <div className="col-span-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-slate-300">Milking Times (Direct Yield Entry)</label>
                    <span className="text-[11px] text-slate-400">Directly set Morning, Afternoon, or Evening</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-emerald-500/10 border border-emerald-500/30 p-2.5 rounded-xl focus-within:ring-2 focus-within:ring-emerald-400 transition-all">
                      <label className="block text-xs font-bold text-emerald-300 mb-1 flex items-center justify-between">
                        <span>🌅 Morning</span>
                        <span className="text-[10px] text-emerald-400/80 font-normal">Liters</span>
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        placeholder="0.0"
                        className="w-full bg-slate-900/80 border border-white/10 rounded-lg px-2.5 py-1.5 text-white font-semibold text-sm outline-none focus:border-emerald-400"
                        value={formData.morning}
                        onChange={e => setFormData({ ...formData, morning: e.target.value })}
                        autoFocus={formData.focusSession === 'morning'}
                      />
                    </div>

                    <div className="bg-amber-500/10 border border-amber-500/30 p-2.5 rounded-xl focus-within:ring-2 focus-within:ring-amber-400 transition-all">
                      <label className="block text-xs font-bold text-amber-300 mb-1 flex items-center justify-between">
                        <span>☀️ Afternoon</span>
                        <span className="text-[10px] text-amber-400/80 font-normal">Liters</span>
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        placeholder="0.0"
                        className="w-full bg-slate-900/80 border border-white/10 rounded-lg px-2.5 py-1.5 text-white font-semibold text-sm outline-none focus:border-amber-400"
                        value={formData.afternoon}
                        onChange={e => setFormData({ ...formData, afternoon: e.target.value })}
                        autoFocus={formData.focusSession === 'afternoon'}
                      />
                    </div>

                    <div className="bg-blue-500/10 border border-blue-500/30 p-2.5 rounded-xl focus-within:ring-2 focus-within:ring-blue-400 transition-all">
                      <label className="block text-xs font-bold text-blue-300 mb-1 flex items-center justify-between">
                        <span>🌙 Evening</span>
                        <span className="text-[10px] text-blue-400/80 font-normal">Liters</span>
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        placeholder="0.0"
                        className="w-full bg-slate-900/80 border border-white/10 rounded-lg px-2.5 py-1.5 text-white font-semibold text-sm outline-none focus:border-blue-400"
                        value={formData.evening}
                        onChange={e => setFormData({ ...formData, evening: e.target.value })}
                        autoFocus={formData.focusSession === 'evening'}
                      />
                    </div>
                  </div>
                </div>

                <div className="col-span-1">
                  <label className="block text-xs font-medium text-slate-400 mb-1">Given to Calves (L)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    className="input-field"
                    value={formData.calvesAmount}
                    onChange={e => setFormData({ ...formData, calvesAmount: e.target.value })}
                    placeholder="0.0"
                  />
                </div>

                <div className="col-span-1 flex flex-col justify-end">
                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                    <span className="text-xs text-slate-400">Total Day Yield:</span>
                    <span className="text-base font-bold text-emerald-400">
                      {((Number(formData.morning) || 0) + (Number(formData.afternoon) || 0) + (Number(formData.evening) || 0)).toFixed(1)} L
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <button type="button" className="btn-secondary" onClick={() => { setIsModalOpen(false); setEditingRecord(null); setEditingRow(null); setFormData(initialForm) }}>Cancel</button>
            <button type="submit" className="btn-primary">Save Record</button>
          </div>
        </form>
      </Modal>

      {/* ─── NAME PREVIOUS COWS MODAL ───────────────────────────────────────── */}
      <Modal
        isOpen={isNameModalOpen}
        onClose={() => setIsNameModalOpen(false)}
        title="🏷️ Identify / Name Previous Cows"
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-400">
            These are the <strong className="text-amber-300 font-semibold">{previousCows.length} cows</strong> with historical milk records that were deleted from the active herd. Enter their real cow names and tag IDs so they appear accurately in August and all past monthly/weekly reports, PDFs, and Excel exports.
          </p>
          <div className="max-h-96 overflow-y-auto space-y-2.5 pr-1">
            {previousCows.map((cow, idx) => (
              <div key={cow.id} className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-mono text-slate-300 font-bold">
                    #{idx + 1} • <span className="text-emerald-400 font-bold">{cow.totalProduction?.toFixed(1) || 0} L</span> total recorded ({cow.recordCount || 0} sessions)
                  </span>
                  <span className="text-[10px] text-slate-400 bg-white/5 px-2 py-0.5 rounded">
                    {cow.firstDate || ''} to {cow.lastDate || ''}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Cow Name</label>
                    <input
                      type="text"
                      className="input-field py-1 px-2 text-xs w-full"
                      placeholder="e.g. Bessie, Daisy"
                      value={editHistoricalMap[cow.id]?.name || ''}
                      onChange={e => setEditHistoricalMap(prev => ({
                        ...prev,
                        [cow.id]: { ...prev[cow.id], name: e.target.value }
                      }))}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Tag Number</label>
                    <input
                      type="text"
                      className="input-field py-1 px-2 text-xs w-full"
                      placeholder="e.g. 012, TAG-05"
                      value={editHistoricalMap[cow.id]?.tagNumber || ''}
                      onChange={e => setEditHistoricalMap(prev => ({
                        ...prev,
                        [cow.id]: { ...prev[cow.id], tagNumber: e.target.value }
                      }))}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
            <button
              type="button"
              className="btn-secondary px-3 py-1.5 text-xs"
              onClick={() => setIsNameModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary px-4 py-1.5 text-xs font-semibold"
              onClick={handleSaveHistoricalNames}
            >
              Save All Cow Names
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
