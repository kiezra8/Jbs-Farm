import { useEffect } from 'react'
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

  const handleExportMilk = (type) => {
    const pivotedRowsMap = {}
    milkRecords.forEach(r => {
      const key = `${r.date}_${r.animalId}`
      if (!pivotedRowsMap[key]) {
        const animal = animals.find(a => String(a.id) === String(r.animalId))
        pivotedRowsMap[key] = {
          date: r.date,
          animalId: r.animalId,
          animalTag: animal?.tagNumber || '—',
          animalName: animal?.name || '—',
          morning: 0,
          afternoon: 0,
          evening: 0,
          totalAmount: 0
        }
      }
      const row = pivotedRowsMap[key]
      if (r.session === 'Morning') row.morning += (r.amount || 0)
      if (r.session === 'Afternoon') row.afternoon += (r.amount || 0)
      if (r.session === 'Evening') row.evening += (r.amount || 0)
      row.totalAmount += (r.amount || 0)
    })

    const rows = Object.values(pivotedRowsMap).map(row => ({
      ...row,
      morning: row.morning > 0 ? `${row.morning} L` : '—',
      afternoon: row.afternoon > 0 ? `${row.afternoon} L` : '—',
      evening: row.evening > 0 ? `${row.evening} L` : '—',
      totalAmount: `${row.totalAmount} L`
    }))

    const pdfColumns = [
      { key: 'animalTag', header: 'Cow Tag' },
      { key: 'animalName', header: 'Name' },
      { key: 'morning', header: 'Morning' },
      { key: 'afternoon', header: 'Afternoon' },
      { key: 'evening', header: 'Evening' },
      { key: 'totalAmount', header: 'Total' }
    ]

    if (type === 'pdf') {
      exportToPDF({ 
        title: 'Milk Production Report',
        columns: pdfColumns,
        rows: rows,
        groupBy: 'date',
        groupFormat: (val) => new Date(val).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      })
    } else {
      exportToExcel({
        title: 'Milk Production Report',
        columns: [{ key: 'date', header: 'Date' }, ...pdfColumns],
        rows: rows
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
    { title: 'Herd Inventory', desc: 'Full list of all cattle currently on the farm.', action: handleExportHerd },
    { title: 'Milk Production', desc: 'Historical milk yield data.', action: handleExportMilk },
    { title: 'Financial Statement', desc: 'Income and expenses ledger.', action: handleExportFinance },
    { title: 'Health & Vet', desc: 'Vaccinations and treatment history.', action: handleExportHealth },
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
