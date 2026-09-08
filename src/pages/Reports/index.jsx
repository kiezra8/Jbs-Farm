import { useEffect, useState } from 'react'
import { format, startOfWeek, addDays, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns'
import { Download, FileText, FileSpreadsheet, Tag } from 'lucide-react'
import { exportToPDF, exportToExcel } from '../../utils/exporters'
import { useAnimalStore } from '../../store/useAnimalStore'
import { useMilkStore } from '../../store/useMilkStore'
import { useFinanceStore } from '../../store/useFinanceStore'
import { useHealthStore } from '../../store/useHealthStore'
import { loadHistoricalCowNames, buildUnifiedCowList } from '../../services/historicalCows'

export default function Reports() {
  const { animals, loadAnimals } = useAnimalStore()
  const { records: milkRecords, loadRecords: loadMilk } = useMilkStore()
  const { transactions, loadTransactions } = useFinanceStore()
  const { records: healthRecords, loadRecords: loadHealth } = useHealthStore()

  // Date selection states
  const [selectedDailyDate, setSelectedDailyDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [selectedWeeklyDate, setSelectedWeeklyDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [selectedMonthlyDate, setSelectedMonthlyDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [selectedWeeklyCow, setSelectedWeeklyCow] = useState('all')
  const [selectedMonthlyCow, setSelectedMonthlyCow] = useState('all')
  const [historicalNames, setHistoricalNames] = useState({})
  const [milkHerdFilter, setMilkHerdFilter] = useState('all') // 'all' | 'active' | 'previous'

  useEffect(() => {
    loadAnimals()
    loadMilk()
    loadTransactions()
    loadHealth()
    loadHistoricalCowNames().then(map => setHistoricalNames(map || {}))
  }, [])

  const unifiedCows = buildUnifiedCowList(animals, milkRecords, historicalNames)
  const previousCows = unifiedCows.filter(c => c.isHistorical)
  const activeCows = unifiedCows.filter(c => !c.isHistorical)
  const femaleCows = unifiedCows
    .filter(c => {
      if (milkHerdFilter === 'active') return !c.isHistorical
      if (milkHerdFilter === 'previous') return c.isHistorical
      return true
    })
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))

  const handleExportHerd = (type) => {
    const data = {
      title: 'Herd Inventory Report',
      columns: [
        { key: 'tagNumber', header: 'Tag ID' },
        { key: 'name', header: 'Name' },
        { key: 'breed', header: 'Breed' },
        { key: 'gender', header: 'Gender' },
        { key: 'status', header: 'Status' }
      ],
      rows: animals
    }
    if (type === 'pdf') exportToPDF(data)
    else exportToExcel(data)
  }

  const handleExportMilk = (type, period = 'daily') => {
    const formatL = (num) => `${(Number(num) || 0).toFixed(1)} L`
    const formatMoney = (num) => new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX' }).format(num || 0)

    // ─── 1. Monthly Milk Report ──────────────────────────────────────────────
    if (period === 'monthly') {
      const targetDate = new Date(selectedMonthlyDate)
      const year = targetDate.getFullYear()
      const monthStr = String(targetDate.getMonth() + 1).padStart(2, '0')
      const prefix = `${year}-${monthStr}`
      const monthTitle = format(targetDate, 'MMMM yyyy')
      const monthRecords = milkRecords.filter(r => r.date && r.date.startsWith(prefix))

      if (selectedMonthlyCow !== 'all') {
        // Individual Cow Monthly Report
        const cow = unifiedCows.find(a => String(a.id) === String(selectedMonthlyCow))
        const cowName = cow?.name || 'Cow'
        const cowTag = cow?.tagNumber || 'N/A'
        const cowBreed = cow?.breed || 'Dairy'

        const mStart = startOfMonth(targetDate)
        const mEnd = endOfMonth(targetDate)
        const allDays = eachDayOfInterval({ start: mStart, end: mEnd })

        let totM = 0, totA = 0, totE = 0, totY = 0, totC = 0, totN = 0, totRev = 0
        const rows = allDays.map(d => {
          const dStr = format(d, 'yyyy-MM-dd')
          const dayName = format(d, 'EEEE')
          const recs = monthRecords.filter(r => r.date === dStr && String(r.animalId) === String(selectedMonthlyCow))

          let m = 0, a = 0, ev = 0, c = 0
          recs.forEach(r => {
            const amt = Number(r.amount) || 0
            const camt = Number(r.calvesAmount) || 0
            if (r.session === 'Morning') m += amt
            if (r.session === 'Afternoon') a += amt
            if (r.session === 'Evening') ev += amt
            c += camt
          })
          const y = m + a + ev
          const net = Math.max(0, y - c)
          const rev = net * 1500

          totM += m; totA += a; totE += ev; totY += y; totC += c; totN += net; totRev += rev

          return {
            date: dStr,
            dayName,
            morning: m > 0 ? formatL(m) : '—',
            afternoon: a > 0 ? formatL(a) : '—',
            evening: ev > 0 ? formatL(ev) : '—',
            totalAmount: y > 0 ? formatL(y) : '0.0 L',
            calvesAmount: c > 0 ? formatL(c) : '0.0 L',
            netAmount: net > 0 ? formatL(net) : '0.0 L',
            revenue: rev > 0 ? formatMoney(rev) : 'UGX 0'
          }
        })

        // Totals Row
        rows.push({
          date: 'MONTH TOTAL',
          dayName: `${cowBreed}`,
          morning: formatL(totM),
          afternoon: formatL(totA),
          evening: formatL(totE),
          totalAmount: formatL(totY),
          calvesAmount: formatL(totC),
          netAmount: formatL(totN),
          revenue: formatMoney(totRev)
        })

        const columns = [
          { key: 'date', header: 'Date' },
          { key: 'dayName', header: 'Day' },
          { key: 'morning', header: 'Morning (L)' },
          { key: 'afternoon', header: 'Afternoon (L)' },
          { key: 'evening', header: 'Evening (L)' },
          { key: 'totalAmount', header: 'Total (L)' },
          { key: 'calvesAmount', header: 'To Calves (L)' },
          { key: 'netAmount', header: 'Net Sold (L)' },
          { key: 'revenue', header: 'Revenue (UGX)' }
        ]

        const title = `Monthly Milk Report - ${cowName} (${cowTag}) - ${monthTitle}`
        const filename = `Monthly_Milk_${cowName.replace(/\s+/g, '_')}_${cowTag}_${format(targetDate, 'yyyyMM')}`

        if (type === 'pdf') {
          exportToPDF({ title, columns, rows, filename })
        } else {
          exportToExcel({ title, columns, rows, filename })
        }
        return
      } else {
        // All Cows Monthly Report (Cow-by-Cow Breakdown)
        const cowMap = {}
        const cowsToReport = unifiedCows.filter(c => {
          if (milkHerdFilter === 'active') return !c.isHistorical
          if (milkHerdFilter === 'previous') return c.isHistorical
          return true
        })

        cowsToReport.forEach(c => {
          cowMap[c.id] = {
            cowTag: c.tagNumber || 'N/A',
            cowName: c.name || 'Unnamed',
            breed: c.breed || 'Dairy',
            isHistorical: c.isHistorical,
            dates: new Set(),
            morning: 0,
            afternoon: 0,
            evening: 0,
            calves: 0,
            total: 0
          }
        })

        monthRecords.forEach(r => {
          if (!cowMap[r.animalId]) {
            const cow = unifiedCows.find(a => String(a.id) === String(r.animalId))
            if (!cow && milkHerdFilter === 'active') return
            cowMap[r.animalId] = {
              cowTag: cow?.tagNumber || r.tagNumber || 'N/A',
              cowName: cow?.name || r.animalName || 'Unnamed',
              breed: cow?.breed || 'Dairy',
              isHistorical: cow ? cow.isHistorical : true,
              dates: new Set(),
              morning: 0,
              afternoon: 0,
              evening: 0,
              calves: 0,
              total: 0
            }
          }
          const cData = cowMap[r.animalId]
          if (cData) {
            const amt = Number(r.amount) || 0
            const camt = Number(r.calvesAmount) || 0
            if (amt > 0) cData.dates.add(r.date)
            if (r.session === 'Morning') cData.morning += amt
            if (r.session === 'Afternoon') cData.afternoon += amt
            if (r.session === 'Evening') cData.evening += amt
            cData.calves += camt
            cData.total += amt
          }
        })

        let grandM = 0, grandA = 0, grandE = 0, grandTot = 0, grandC = 0, grandN = 0, grandRev = 0
        const rows = Object.values(cowMap)
          .filter(c => c.isHistorical ? c.total > 0 : (milkHerdFilter === 'active' || c.total > 0))
          .sort((a, b) => b.total - a.total)
          .map(c => {
            const net = Math.max(0, c.total - c.calves)
            const rev = net * 1500
            grandM += c.morning; grandA += c.afternoon; grandE += c.evening
            grandTot += c.total; grandC += c.calves; grandN += net; grandRev += rev

            return {
              cowTag: c.cowTag,
              cowName: c.cowName,
              breed: c.breed,
              daysMilked: `${c.dates.size} days`,
              morning: formatL(c.morning),
              afternoon: formatL(c.afternoon),
              evening: formatL(c.evening),
              totalAmount: formatL(c.total),
              calvesAmount: formatL(c.calves),
              netAmount: formatL(net),
              revenue: formatMoney(rev)
            }
          })

        rows.push({
          cowTag: 'ALL COWS TOTAL',
          cowName: `${rows.length} cows`,
          breed: 'Grand Total',
          daysMilked: `${monthTitle}`,
          morning: formatL(grandM),
          afternoon: formatL(grandA),
          evening: formatL(grandE),
          totalAmount: formatL(grandTot),
          calvesAmount: formatL(grandC),
          netAmount: formatL(grandN),
          revenue: formatMoney(grandRev)
        })

        const columns = [
          { key: 'cowTag', header: 'Tag ID' },
          { key: 'cowName', header: 'Cow Name' },
          { key: 'breed', header: 'Breed' },
          { key: 'daysMilked', header: 'Days Milked' },
          { key: 'morning', header: 'Morning (L)' },
          { key: 'afternoon', header: 'Afternoon (L)' },
          { key: 'evening', header: 'Evening (L)' },
          { key: 'totalAmount', header: 'Month Total (L)' },
          { key: 'calvesAmount', header: 'To Calves (L)' },
          { key: 'netAmount', header: 'Net Sold (L)' },
          { key: 'revenue', header: 'Revenue (UGX)' }
        ]

        const title = `Monthly Milk Production Report (By Cow) - ${monthTitle}`
        const filename = `Monthly_Milk_By_Cow_${format(targetDate, 'yyyyMM')}`

        if (type === 'pdf') {
          exportToPDF({ title, columns, rows, filename })
        } else {
          exportToExcel({ title, columns, rows, filename })
        }
        return
      }
    }

    // ─── 2. Weekly Milk Report ───────────────────────────────────────────────
    if (period === 'weekly') {
      const targetDate = new Date(selectedWeeklyDate)
      const start = startOfWeek(targetDate, { weekStartsOn: 1 })
      const end = addDays(start, 6)
      const startStr = format(start, 'yyyy-MM-dd')
      const endStr = format(end, 'yyyy-MM-dd')
      const weekRangeTitle = `${format(start, 'dd MMM')} - ${format(end, 'dd MMM yyyy')}`
      const weekRecords = milkRecords.filter(r => r.date >= startStr && r.date <= endStr)

      if (selectedWeeklyCow !== 'all') {
        // Individual Cow Weekly Report
        const cow = unifiedCows.find(a => String(a.id) === String(selectedWeeklyCow))
        const cowName = cow?.name || 'Cow'
        const cowTag = cow?.tagNumber || 'N/A'

        let totM = 0, totA = 0, totE = 0, totY = 0, totC = 0, totN = 0, totRev = 0
        const rows = [0, 1, 2, 3, 4, 5, 6].map(offset => {
          const d = addDays(start, offset)
          const dStr = format(d, 'yyyy-MM-dd')
          const dayName = format(d, 'EEEE')
          const recs = weekRecords.filter(r => r.date === dStr && String(r.animalId) === String(selectedWeeklyCow))

          let m = 0, a = 0, ev = 0, c = 0
          recs.forEach(r => {
            const amt = Number(r.amount) || 0
            const camt = Number(r.calvesAmount) || 0
            if (r.session === 'Morning') m += amt
            if (r.session === 'Afternoon') a += amt
            if (r.session === 'Evening') ev += amt
            c += camt
          })
          const y = m + a + ev
          const net = Math.max(0, y - c)
          const rev = net * 1500

          totM += m; totA += a; totE += ev; totY += y; totC += c; totN += net; totRev += rev

          return {
            date: dStr,
            dayName,
            morning: m > 0 ? formatL(m) : '—',
            afternoon: a > 0 ? formatL(a) : '—',
            evening: ev > 0 ? formatL(ev) : '—',
            totalAmount: y > 0 ? formatL(y) : '0.0 L',
            calvesAmount: c > 0 ? formatL(c) : '0.0 L',
            netAmount: net > 0 ? formatL(net) : '0.0 L',
            revenue: rev > 0 ? formatMoney(rev) : 'UGX 0'
          }
        })

        rows.push({
          date: 'WEEK TOTAL',
          dayName: `${cow?.breed || 'Dairy'}`,
          morning: formatL(totM),
          afternoon: formatL(totA),
          evening: formatL(totE),
          totalAmount: formatL(totY),
          calvesAmount: formatL(totC),
          netAmount: formatL(totN),
          revenue: formatMoney(totRev)
        })

        const columns = [
          { key: 'date', header: 'Date' },
          { key: 'dayName', header: 'Day' },
          { key: 'morning', header: 'Morning (L)' },
          { key: 'afternoon', header: 'Afternoon (L)' },
          { key: 'evening', header: 'Evening (L)' },
          { key: 'totalAmount', header: 'Total (L)' },
          { key: 'calvesAmount', header: 'To Calves (L)' },
          { key: 'netAmount', header: 'Net Sold (L)' },
          { key: 'revenue', header: 'Revenue (UGX)' }
        ]

        const title = `Weekly Milk Report - ${cowName} (${cowTag}) (${weekRangeTitle})`
        const filename = `Weekly_Milk_${cowName.replace(/\s+/g, '_')}_${cowTag}_${format(start, 'yyyyMMdd')}`

        if (type === 'pdf') {
          exportToPDF({ title, columns, rows, filename })
        } else {
          exportToExcel({ title, columns, rows, filename })
        }
        return
      } else {
        // All Cows Weekly Report (Cow-by-Cow Breakdown)
        const cowMap = {}
        const cowsToReport = unifiedCows.filter(c => {
          if (milkHerdFilter === 'active') return !c.isHistorical
          if (milkHerdFilter === 'previous') return c.isHistorical
          return true
        })

        cowsToReport.forEach(c => {
          cowMap[c.id] = {
            cowTag: c.tagNumber || 'N/A',
            cowName: c.name || 'Unnamed',
            breed: c.breed || 'Dairy',
            isHistorical: c.isHistorical,
            morning: 0,
            afternoon: 0,
            evening: 0,
            calves: 0,
            total: 0
          }
        })

        weekRecords.forEach(r => {
          if (!cowMap[r.animalId]) {
            const cow = unifiedCows.find(a => String(a.id) === String(r.animalId))
            if (!cow && milkHerdFilter === 'active') return
            cowMap[r.animalId] = {
              cowTag: cow?.tagNumber || r.tagNumber || 'N/A',
              cowName: cow?.name || r.animalName || 'Unnamed',
              breed: cow?.breed || 'Dairy',
              isHistorical: cow ? cow.isHistorical : true,
              morning: 0,
              afternoon: 0,
              evening: 0,
              calves: 0,
              total: 0
            }
          }
          const cData = cowMap[r.animalId]
          if (cData) {
            const amt = Number(r.amount) || 0
            const camt = Number(r.calvesAmount) || 0
            if (r.session === 'Morning') cData.morning += amt
            if (r.session === 'Afternoon') cData.afternoon += amt
            if (r.session === 'Evening') cData.evening += amt
            cData.calves += camt
            cData.total += amt
          }
        })

        let grandM = 0, grandA = 0, grandE = 0, grandTot = 0, grandC = 0, grandN = 0, grandRev = 0
        const rows = Object.values(cowMap)
          .filter(c => c.isHistorical ? c.total > 0 : (milkHerdFilter === 'active' || c.total > 0))
          .sort((a, b) => b.total - a.total)
          .map(c => {
            const net = Math.max(0, c.total - c.calves)
            const rev = net * 1500
            grandM += c.morning; grandA += c.afternoon; grandE += c.evening
            grandTot += c.total; grandC += c.calves; grandN += net; grandRev += rev

            return {
              cowTag: c.cowTag,
              cowName: c.cowName,
              breed: c.breed,
              morning: formatL(c.morning),
              afternoon: formatL(c.afternoon),
              evening: formatL(c.evening),
              totalAmount: formatL(c.total),
              calvesAmount: formatL(c.calves),
              netAmount: formatL(net),
              revenue: formatMoney(rev)
            }
          })

        rows.push({
          cowTag: 'WEEK TOTAL (ALL COWS)',
          cowName: `${rows.length} cows`,
          breed: 'Grand Total',
          morning: formatL(grandM),
          afternoon: formatL(grandA),
          evening: formatL(grandE),
          totalAmount: formatL(grandTot),
          calvesAmount: formatL(grandC),
          netAmount: formatL(grandN),
          revenue: formatMoney(grandRev)
        })

        const columns = [
          { key: 'cowTag', header: 'Tag ID' },
          { key: 'cowName', header: 'Cow Name' },
          { key: 'breed', header: 'Breed' },
          { key: 'morning', header: 'Morning (L)' },
          { key: 'afternoon', header: 'Afternoon (L)' },
          { key: 'evening', header: 'Evening (L)' },
          { key: 'totalAmount', header: 'Week Total (L)' },
          { key: 'calvesAmount', header: 'To Calves (L)' },
          { key: 'netAmount', header: 'Net Sold (L)' },
          { key: 'revenue', header: 'Revenue (UGX)' }
        ]

        const title = `Weekly Milk Production Report (By Cow) - (${weekRangeTitle})`
        const filename = `Weekly_Milk_By_Cow_${format(start, 'yyyyMMdd')}`

        if (type === 'pdf') {
          exportToPDF({ title, columns, rows, filename })
        } else {
          exportToExcel({ title, columns, rows, filename })
        }
        return
      }
    }

    // ─── 3. Daily Milk Report ────────────────────────────────────────────────
    if (period === 'daily') {
      const dailyRecords = milkRecords.filter(r => r.date === selectedDailyDate)
      const cowMap = {}
      femaleCows.forEach(c => {
        cowMap[c.id] = {
          cowTag: c.tagNumber || 'N/A',
          cowName: c.name || 'Unnamed',
          breed: c.breed || 'Dairy',
          morning: 0,
          afternoon: 0,
          evening: 0,
          calves: 0,
          total: 0
        }
      })

      dailyRecords.forEach(r => {
        if (!cowMap[r.animalId]) {
          const animal = animals.find(a => String(a.id) === String(r.animalId))
          cowMap[r.animalId] = {
            cowTag: animal?.tagNumber || 'N/A',
            cowName: animal?.name || 'Unnamed',
            breed: animal?.breed || 'Dairy',
            morning: 0,
            afternoon: 0,
            evening: 0,
            calves: 0,
            total: 0
          }
        }
        const row = cowMap[r.animalId]
        const amt = Number(r.amount) || 0
        const camt = Number(r.calvesAmount) || 0
        if (r.session === 'Morning') row.morning += amt
        if (r.session === 'Afternoon') row.afternoon += amt
        if (r.session === 'Evening') row.evening += amt
        row.calves += camt
        row.total += amt
      })

      let dM = 0, dA = 0, dE = 0, dTot = 0, dC = 0, dN = 0, dRev = 0
      const rows = Object.values(cowMap)
        .sort((a, b) => b.total - a.total)
        .map(c => {
          const net = Math.max(0, c.total - c.calves)
          const rev = net * 1500
          dM += c.morning; dA += c.afternoon; dE += c.evening
          dTot += c.total; dC += c.calves; dN += net; dRev += rev
          return {
            cowTag: c.cowTag,
            cowName: c.cowName,
            breed: c.breed,
            morning: formatL(c.morning),
            afternoon: formatL(c.afternoon),
            evening: formatL(c.evening),
            totalAmount: formatL(c.total),
            calvesAmount: formatL(c.calves),
            netAmount: formatL(net),
            revenue: formatMoney(rev)
          }
        })

      rows.push({
        cowTag: 'DAILY TOTAL',
        cowName: `${rows.length} cows`,
        breed: 'All Cows',
        morning: formatL(dM),
        afternoon: formatL(dA),
        evening: formatL(dE),
        totalAmount: formatL(dTot),
        calvesAmount: formatL(dC),
        netAmount: formatL(dN),
        revenue: formatMoney(dRev)
      })

      const columns = [
        { key: 'cowTag', header: 'Tag ID' },
        { key: 'cowName', header: 'Cow Name' },
        { key: 'breed', header: 'Breed' },
        { key: 'morning', header: 'Morning (L)' },
        { key: 'afternoon', header: 'Afternoon (L)' },
        { key: 'evening', header: 'Evening (L)' },
        { key: 'totalAmount', header: 'Total (L)' },
        { key: 'calvesAmount', header: 'To Calves (L)' },
        { key: 'netAmount', header: 'Net Sold (L)' },
        { key: 'revenue', header: 'Revenue (UGX)' }
      ]

      const title = `Daily Milk Production Report - ${format(new Date(selectedDailyDate), 'EEEE, dd MMMM yyyy')}`
      const filename = `Daily_Milk_${selectedDailyDate}`

      if (type === 'pdf') {
        exportToPDF({ title, columns, rows, filename })
      } else {
        exportToExcel({ title, columns, rows, filename })
      }
      return
    }

    // ─── 4. All-Time Weekly Income ───────────────────────────────────────────
    if (period === 'all_time_weekly') {
      const pivotedRowsMap = {}
      milkRecords.forEach(r => {
        const d = new Date(r.date)
        const dateKey = startOfWeek(d, { weekStartsOn: 1 }).toISOString().split('T')[0]
        const key = `${dateKey}_${r.animalId}`
        if (!pivotedRowsMap[key]) {
          const animal = animals.find(a => String(a.id) === String(r.animalId))
          pivotedRowsMap[key] = {
            date: dateKey,
            animalId: r.animalId,
            animalTag: animal?.tagNumber || '—',
            animalName: animal?.name || '—',
            morning: 0, afternoon: 0, evening: 0, calvesAmount: 0, totalAmount: 0
          }
        }
        const row = pivotedRowsMap[key]
        if (r.session === 'Morning') row.morning += (Number(r.amount) || 0)
        if (r.session === 'Afternoon') row.afternoon += (Number(r.amount) || 0)
        if (r.session === 'Evening') row.evening += (Number(r.amount) || 0)
        row.calvesAmount += (Number(r.calvesAmount) || 0)
        row.totalAmount += (Number(r.amount) || 0)
      })

      const groupedByDate = {}
      Object.values(pivotedRowsMap).forEach(row => {
        if (!groupedByDate[row.date]) groupedByDate[row.date] = []
        groupedByDate[row.date].push(row)
      })

      const finalRows = []
      Object.keys(groupedByDate).sort((a, b) => new Date(b) - new Date(a)).forEach(date => {
        const groupRows = groupedByDate[date]
        let tMorning = 0, tAfternoon = 0, tEvening = 0, tTotal = 0, tCalves = 0, tNet = 0
        groupRows.forEach(row => {
          tMorning += row.morning
          tAfternoon += row.afternoon
          tEvening += row.evening
          tTotal += row.totalAmount
          tCalves += row.calvesAmount
          tNet += (row.totalAmount - row.calvesAmount)
        })

        const formattedGroupRows = groupRows.map(row => {
          const netAmount = row.totalAmount - row.calvesAmount
          const revenue = netAmount * 1500
          return {
            ...row,
            morning: formatL(row.morning),
            afternoon: formatL(row.afternoon),
            evening: formatL(row.evening),
            totalAmount: formatL(row.totalAmount),
            calvesAmount: formatL(row.calvesAmount),
            netAmount: formatL(netAmount),
            revenue: formatMoney(revenue)
          }
        })
        finalRows.push(...formattedGroupRows)
        finalRows.push({
          date: date,
          animalTag: 'TOTAL',
          animalName: '',
          morning: formatL(tMorning),
          afternoon: formatL(tAfternoon),
          evening: formatL(tEvening),
          totalAmount: formatL(tTotal),
          calvesAmount: formatL(tCalves),
          netAmount: formatL(tNet),
          revenue: formatMoney(tNet * 1500)
        })
      })

      const pdfColumns = [
        { key: 'animalTag', header: 'Cow Tag' },
        { key: 'animalName', header: 'Name' },
        { key: 'morning', header: 'Morning' },
        { key: 'afternoon', header: 'Afternoon' },
        { key: 'evening', header: 'Evening' },
        { key: 'totalAmount', header: 'Total' },
        { key: 'calvesAmount', header: 'Calves' },
        { key: 'netAmount', header: 'Net' },
        { key: 'revenue', header: 'Revenue' }
      ]

      const title = 'All-Time Weekly Income Report'
      const groupFormat = (val) => `Week of ${new Date(val).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })}`

      if (type === 'pdf') {
        exportToPDF({ title, columns: pdfColumns, rows: finalRows, groupBy: 'date', groupFormat })
      } else {
        exportToExcel({ title, columns: [{ key: 'date', header: 'Week of' }, ...pdfColumns], rows: finalRows })
      }
    }
  }

  const handleExportFinance = (type) => {
    const data = {
      title: 'Financial Statement Report',
      columns: [
        { key: 'date', header: 'Date' },
        { key: 'type', header: 'Type' },
        { key: 'category', header: 'Category' },
        { key: 'amount', header: 'Amount' },
        { key: 'reference', header: 'Reference' },
        { key: 'description', header: 'Description' }
      ],
      rows: transactions.map(t => ({
        ...t,
        amount: `Ushs ${(t.amount || 0).toLocaleString()}`
      }))
    }
    if (type === 'pdf') exportToPDF(data)
    else exportToExcel(data)
  }

  const handleExportHealth = (type) => {
    const data = {
      title: 'Health & Vet Report',
      columns: [
        { key: 'date', header: 'Date' },
        { key: 'animalTag', header: 'Animal Tag' },
        { key: 'animalName', header: 'Name' },
        { key: 'type', header: 'Event Type' },
        { key: 'details', header: 'Details' },
        { key: 'cost', header: 'Cost' },
        { key: 'vet', header: 'Vet' }
      ],
      rows: healthRecords.map(r => {
        const animal = animals.find(a => String(a.id) === String(r.animalId))
        const details = r.type === 'Treatment' ? r.diagnosis : r.type === 'Vaccination' ? r.vaccine : r.notes
        return {
          ...r,
          animalTag: animal?.tagNumber || '—',
          animalName: animal?.name || '—',
          details: details || '—',
          cost: `Ushs ${(r.cost || 0).toLocaleString()}`
        }
      })
    }
    if (type === 'pdf') exportToPDF(data)
    else exportToExcel(data)
  }

  const reports = [
    { title: 'Herd Inventory', desc: 'Full list of all cattle currently on the farm.', action: (type) => handleExportHerd(type) },
    { 
      title: 'Daily Milk Production', 
      desc: 'Detailed daily milk yield data by cow.', 
      action: (type) => handleExportMilk(type, 'daily'),
      selector: (
        <div className="mt-2.5">
          <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Select Date</label>
          <input 
            type="date" 
            className="input-field mt-1 text-xs py-1.5 px-2 max-w-[200px] border-white/10" 
            value={selectedDailyDate} 
            onChange={e => setSelectedDailyDate(e.target.value)} 
          />
        </div>
      )
    },
    { 
      title: 'Weekly Milk Summary', 
      desc: 'Weekly milk records tracked and exported by cow name or all cows.', 
      action: (type) => handleExportMilk(type, 'weekly'),
      selector: (
        <div className="mt-2.5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Herd View:</span>
            <div className="flex bg-white/5 p-0.5 rounded-lg border border-white/10 text-[10px]">
              <button
                type="button"
                onClick={() => setMilkHerdFilter('all')}
                className={`px-2 py-0.5 rounded ${milkHerdFilter === 'all' ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setMilkHerdFilter('active')}
                className={`px-2 py-0.5 rounded ${milkHerdFilter === 'active' ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                Active ({activeCows.length})
              </button>
              <button
                type="button"
                onClick={() => setMilkHerdFilter('previous')}
                className={`px-2 py-0.5 rounded ${milkHerdFilter === 'previous' ? 'bg-amber-500 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                Previous ({previousCows.length})
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Select Date in Week</label>
              <input 
                type="date" 
                className="input-field mt-1 text-xs py-1.5 px-2 w-full border-white/10" 
                value={selectedWeeklyDate} 
                onChange={e => setSelectedWeeklyDate(e.target.value)} 
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Track By Cow</label>
              <select
                className="input-field mt-1 text-xs py-1.5 px-2 w-full border-white/10"
                value={selectedWeeklyCow}
                onChange={e => setSelectedWeeklyCow(e.target.value)}
              >
                <option value="all">All Cows (Weekly Breakdown)</option>
                <optgroup label="Active Herd (Current Cows)">
                  {activeCows.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name || 'Unnamed'} ({c.tagNumber})
                    </option>
                  ))}
                </optgroup>
                {previousCows.length > 0 && (
                  <optgroup label="Previous Herd (Historical Records)">
                    {previousCows.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name || 'Unnamed'} ({c.tagNumber})
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
          </div>
        </div>
      )
    },
    { 
      title: 'Monthly Milk Summary', 
      desc: 'Monthly milk records tracked and exported by cow name or all cows.', 
      action: (type) => handleExportMilk(type, 'monthly'),
      selector: (
        <div className="mt-2.5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Herd View:</span>
            <div className="flex bg-white/5 p-0.5 rounded-lg border border-white/10 text-[10px]">
              <button
                type="button"
                onClick={() => setMilkHerdFilter('all')}
                className={`px-2 py-0.5 rounded ${milkHerdFilter === 'all' ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setMilkHerdFilter('active')}
                className={`px-2 py-0.5 rounded ${milkHerdFilter === 'active' ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                Active ({activeCows.length})
              </button>
              <button
                type="button"
                onClick={() => setMilkHerdFilter('previous')}
                className={`px-2 py-0.5 rounded ${milkHerdFilter === 'previous' ? 'bg-amber-500 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                Previous ({previousCows.length})
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Select Month</label>
              <input 
                type="month" 
                className="input-field mt-1 text-xs py-1.5 px-2 w-full border-white/10" 
                value={selectedMonthlyDate.slice(0, 7)} 
                onChange={e => setSelectedMonthlyDate(e.target.value ? `${e.target.value}-01` : format(new Date(), 'yyyy-MM-dd'))} 
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Track By Cow</label>
              <select
                className="input-field mt-1 text-xs py-1.5 px-2 w-full border-white/10"
                value={selectedMonthlyCow}
                onChange={e => setSelectedMonthlyCow(e.target.value)}
              >
                <option value="all">All Cows (Monthly Performance)</option>
                <optgroup label="Active Herd (Current Cows)">
                  {activeCows.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name || 'Unnamed'} ({c.tagNumber})
                    </option>
                  ))}
                </optgroup>
                {previousCows.length > 0 && (
                  <optgroup label="Previous Herd (Historical Records)">
                    {previousCows.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name || 'Unnamed'} ({c.tagNumber})
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
          </div>
        </div>
      )
    },
    { 
      title: 'All-Time Weekly Income', 
      desc: 'Milk production aggregated by week since the app started.', 
      action: (type) => handleExportMilk(type, 'all_time_weekly')
    },
    { title: 'Financial Statement', desc: 'Income and expenses ledger.', action: (type) => handleExportFinance(type) },
    { title: 'Health & Vet', desc: 'Vaccinations and treatment history.', action: (type) => handleExportHealth(type) },
  ]

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports & Exports</h1>
          <p className="text-slate-400 text-sm mt-1">Generate PDF and Excel reports.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reports.map(r => (
          <div key={r.title} className="glass-card p-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex-1">
              <h3 className="font-display font-semibold text-white text-lg">{r.title}</h3>
              <p className="text-sm text-slate-400 mt-1">{r.desc}</p>
              {r.selector}
            </div>
            <div className="flex gap-2 w-full sm:w-auto mt-4 sm:mt-0">
              <button onClick={() => r.action('pdf')} className="btn-secondary flex-1 sm:flex-none justify-center px-3 py-1.5" title="Export PDF">
                <FileText size={16} className="text-red-400" /> PDF
              </button>
              <button onClick={() => r.action('excel')} className="btn-secondary flex-1 sm:flex-none justify-center px-3 py-1.5" title="Export Excel">
                <FileSpreadsheet size={16} className="text-green-400" /> Excel
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
