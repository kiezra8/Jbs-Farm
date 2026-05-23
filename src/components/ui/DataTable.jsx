import { useState, useMemo } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-react'

export default function DataTable({ columns, data, pageSize = 10, emptyMessage = 'No records found' }) {
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  const [page, setPage] = useState(1)

  const sorted = useMemo(() => {
    if (!sortKey) return data
    return [...data].sort((a, b) => {
      const va = a[sortKey] ?? ''
      const vb = b[sortKey] ?? ''
      const cmp = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb))
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [data, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const paged = sorted.slice((page - 1) * pageSize, page * pageSize)

  const handleSort = (key) => {
    if (!key) return
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
    setPage(1)
  }

  return (
    <div className="glass-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              {columns.map(col => (
                <th key={col.key || col.label}
                  onClick={() => col.sortable !== false && handleSort(col.key)}
                  className={`text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400 select-none
                    ${col.sortable !== false && col.key ? 'cursor-pointer hover:text-white transition-colors' : ''}`}
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    {col.sortable !== false && col.key && (
                      sortKey === col.key
                        ? sortDir === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />
                        : <ChevronsUpDown size={13} className="opacity-30" />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="text-center py-12 text-slate-500">
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-3xl">🐄</span>
                    <span>{emptyMessage}</span>
                  </div>
                </td>
              </tr>
            ) : paged.map((row, i) => (
              <tr key={row.id ?? i}
                className="table-row-hover border-t"
                style={{ borderColor: 'rgba(255,255,255,0.04)' }}
                onClick={() => row.onClick?.()}
              >
                {columns.map(col => (
                  <td key={col.key || col.label} className="px-4 py-3 text-slate-300">
                    {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <span className="text-xs text-slate-500">
            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, sorted.length)} of {sorted.length}
          </span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-30 text-slate-400">
              <ChevronLeft size={15} />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const p = totalPages <= 5 ? i + 1 : Math.max(1, page - 2) + i
              if (p > totalPages) return null
              return (
                <button key={p} onClick={() => setPage(p)}
                  className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors
                    ${p === page ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'hover:bg-white/10 text-slate-400'}`}>
                  {p}
                </button>
              )
            })}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-30 text-slate-400">
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
