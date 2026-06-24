import { useEffect } from 'react'
import { startOfWeek, startOfMonth } from 'date-fns'
import { Download, FileText, FileSpreadsheet } from 'lucide-react'
import { exportToPDF, exportToExcel } from '../../utils/exporters'
import { useAnimalStore } from '../../store/useAnimalStore'
import { useMilkStore } from '../../store/useMilkStore'
import { useFinanceStore } from '../../store/useFinanceStore'
import { useHealthStore } from '../../store/useHealthStore'

export default function Reports() {
  const { animals, loadAnimals } = useAnimalStore()
  const { records: milkRecords, loadRecords: loadMilk } = useMilkStore()
  const { transactions, loadTransactions } = useFinanceStore()
  const { records: healthRecords, loadRecords: loadHealth } = useHealthStore()

  useEffect(() => {
    loadAnimals()
    loadMilk()
    loadTransactions()
    loadHealth()
  }, [])

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
    const pivotedRowsMap = {}
    milkRecords.forEach(r => {
      let dateKey = r.date;
      if (period === 'weekly') {
        const d = new Date(r.date);
        dateKey = startOfWeek(d, { weekStartsOn: 1 }).toISOString().split('T')[0];
      } else if (period === 'monthly') {
        const d = new Date(r.date);
        dateKey = startOfMonth(d).toISOString().split('T')[0];
      }

      const key = `${dateKey}_${r.animalId}`
      if (!pivotedRowsMap[key]) {
        const animal = animals.find(a => String(a.id) === String(r.animalId))
        pivotedRowsMap[key] = {
          date: dateKey,
          animalId: r.animalId,
          animalTag: animal?.tagNumber || '—',
          animalName: animal?.name || '—',
          morning: 0,
          afternoon: 0,
          evening: 0,
          calvesAmount: 0,
          totalAmount: 0
        }
      }
      const row = pivotedRowsMap[key]
      if (r.session === 'Morning') row.morning += (r.amount || 0)
      if (r.session === 'Afternoon') row.afternoon += (r.amount || 0)
      if (r.session === 'Evening') row.evening += (r.amount || 0)
      row.calvesAmount += (r.calvesAmount || 0)
      row.totalAmount += (r.amount || 0)
    })

    const groupedByDate = {};
    Object.values(pivotedRowsMap).forEach(row => {
      if(!groupedByDate[row.date]) groupedByDate[row.date] = [];
      groupedByDate[row.date].push(row);
    });

    const finalRows = [];
    Object.keys(groupedByDate).sort((a,b) => new Date(b) - new Date(a)).forEach(date => {
      const groupRows = groupedByDate[date];
      
      let tMorning = 0, tAfternoon = 0, tEvening = 0, tTotal = 0, tCalves = 0, tNet = 0;
      
      groupRows.forEach(row => {
        tMorning += row.morning;
        tAfternoon += row.afternoon;
        tEvening += row.evening;
        tTotal += row.totalAmount;
        tCalves += row.calvesAmount;
        tNet += (row.totalAmount - row.calvesAmount);
      });

      const formattedGroupRows = groupRows.map(row => {
        const netAmount = row.totalAmount - row.calvesAmount
        const revenue = netAmount * 1500
        return {
          ...row,
          morning: row.morning > 0 ? `${row.morning.toFixed(1)} L` : '—',
          afternoon: row.afternoon > 0 ? `${row.afternoon.toFixed(1)} L` : '—',
          evening: row.evening > 0 ? `${row.evening.toFixed(1)} L` : '—',
          totalAmount: `${row.totalAmount.toFixed(1)} L`,
          calvesAmount: `${row.calvesAmount.toFixed(1)} L`,
          netAmount: `${netAmount.toFixed(1)} L`,
          revenue: new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX' }).format(revenue)
        }
      });
      
      finalRows.push(...formattedGroupRows);
      
      finalRows.push({
        date: date,
        animalTag: 'TOTAL',
        animalName: '',
        morning: `${tMorning.toFixed(1)} L`,
        afternoon: `${tAfternoon.toFixed(1)} L`,
        evening: `${tEvening.toFixed(1)} L`,
        totalAmount: `${tTotal.toFixed(1)} L`,
        calvesAmount: `${tCalves.toFixed(1)} L`,
        netAmount: `${tNet.toFixed(1)} L`,
        revenue: new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX' }).format(tNet * 1500)
      });
    });

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

    let title = 'Milk Production Report'
    let groupFormat = (val) => new Date(val).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    
    if (period === 'weekly') {
      title = 'Weekly Milk Production Report';
      groupFormat = (val) => `Week of ${new Date(val).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })}`;
    } else if (period === 'monthly') {
      title = 'Monthly Milk Production Report';
      groupFormat = (val) => new Date(val).toLocaleDateString('en-GB', { year: 'numeric', month: 'long' });
    }

    if (type === 'pdf') {
      exportToPDF({ 
        title: title,
        columns: pdfColumns,
        rows: finalRows,
        groupBy: 'date',
        groupFormat: groupFormat
      })
    } else {
      exportToExcel({
        title: title,
        columns: [{ key: 'date', header: 'Date (Group)' }, ...pdfColumns],
        rows: finalRows
      })
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
    { title: 'Daily Milk Production', desc: 'Historical daily milk yield data.', action: (type) => handleExportMilk(type, 'daily') },
    { title: 'Weekly Milk Summary', desc: 'Milk production aggregated by week.', action: (type) => handleExportMilk(type, 'weekly') },
    { title: 'Monthly Milk Summary', desc: 'Milk production aggregated by month.', action: (type) => handleExportMilk(type, 'monthly') },
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
            <div>
              <h3 className="font-display font-semibold text-white text-lg">{r.title}</h3>
              <p className="text-sm text-slate-400 mt-1">{r.desc}</p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
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
