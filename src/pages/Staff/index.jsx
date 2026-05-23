import { useEffect } from 'react'
import { Plus } from 'lucide-react'
import { useStaffStore } from '../../store/useStaffStore'
import DataTable from '../../components/ui/DataTable'
import { Badge } from '../../components/ui/Badge'
import { formatKES } from '../../utils/formatters'
import { format } from 'date-fns'

export default function Staff() {
  const { staff, tasks, loadAll, getStats } = useStaffStore()

  useEffect(() => {
    loadAll()
  }, [])

  const stats = getStats()

  const staffCols = [
    { key: 'name', label: 'Name', render: (val, row) => (
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-slate-300">
          {val.charAt(0)}
        </div>
        <div>
          <p className="font-medium text-white">{val}</p>
          <p className="text-xs text-slate-400">{row.phone || '—'}</p>
        </div>
      </div>
    )},
    { key: 'role', label: 'Role' },
    { key: 'salary', label: 'Salary', render: (val) => formatKES(val) },
    { key: 'status', label: 'Status', render: (val) => <Badge variant={val === 'Active' ? 'green' : 'gray'}>{val}</Badge> },
    { key: 'joinDate', label: 'Joined', render: (val) => val ? format(new Date(val), 'MMM yyyy') : '—' },
  ]

  const taskCols = [
    { key: 'title', label: 'Task' },
    { key: 'staffId', label: 'Assigned To', render: (val) => staff.find(s => s.id === val)?.name || 'Unassigned' },
    { key: 'priority', label: 'Priority', render: (val) => {
      const v = val === 'High' ? 'red' : val === 'Medium' ? 'amber' : 'green'
      return <Badge variant={v}>{val}</Badge>
    }},
    { key: 'status', label: 'Status', render: (val) => <Badge variant={val === 'Completed' ? 'green' : 'gray'}>{val}</Badge> },
    { key: 'dueDate', label: 'Due Date', render: (val) => val ? format(new Date(val), 'dd MMM yyyy') : '—' },
  ]

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Staff Management</h1>
          <p className="text-slate-400 text-sm mt-1">Manage personnel, attendance, and farm tasks.</p>
        </div>
        <button className="btn-primary"><Plus size={16} /> Add Staff</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-4 flex items-center justify-between">
          <div><p className="text-xs text-slate-400">Total Staff</p><p className="text-2xl font-display font-bold text-white">{stats.total}</p></div>
        </div>
        <div className="glass-card p-4 flex items-center justify-between">
          <div><p className="text-xs text-slate-400">Present Today</p><p className="text-2xl font-display font-bold text-green-400">{stats.present}</p></div>
        </div>
        <div className="glass-card p-4 flex items-center justify-between">
          <div><p className="text-xs text-slate-400">Absent Today</p><p className="text-2xl font-display font-bold text-red-400">{stats.absent}</p></div>
        </div>
        <div className="glass-card p-4 flex items-center justify-between">
          <div><p className="text-xs text-slate-400">Pending Tasks</p><p className="text-2xl font-display font-bold text-amber-400">{stats.pendingTasks}</p></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-white">Staff Roster</h3>
          </div>
          <DataTable columns={staffCols} data={staff} pageSize={6} />
        </div>
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-white">Tasks</h3>
            <button className="btn-secondary text-xs py-1.5 px-3">Assign Task</button>
          </div>
          <DataTable columns={taskCols} data={tasks} pageSize={6} />
        </div>
      </div>
    </div>
  )
}
