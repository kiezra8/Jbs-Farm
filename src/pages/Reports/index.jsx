import { Download, FileText, FileSpreadsheet } from 'lucide-react'
import { exportToPDF, exportToExcel } from '../../utils/exporters'
import { useAnimalStore } from '../../store/useAnimalStore'
import { useMilkStore } from '../../store/useMilkStore'
import { useFinanceStore } from '../../store/useFinanceStore'

export default function Reports() {
  const { animals } = useAnimalStore()
  const { records: milkRecords } = useMilkStore()
  const { transactions } = useFinanceStore()

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

  const reports = [
    { title: 'Herd Inventory', desc: 'Full list of all cattle currently on the farm.', action: handleExportHerd },
    { title: 'Milk Production', desc: 'Historical milk yield data.', action: () => alert('Milk export coming soon') },
    { title: 'Financial Statement', desc: 'Income and expenses ledger.', action: () => alert('Finance export coming soon') },
    { title: 'Health & Vet', desc: 'Vaccinations and treatment history.', action: () => alert('Health export coming soon') },
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
