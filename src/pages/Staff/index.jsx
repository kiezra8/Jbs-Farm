import { useEffect, useState } from 'react'
import { Plus, Edit2, Trash2, CheckCircle2 } from 'lucide-react'
import { useStaffStore } from '../../store/useStaffStore'
import DataTable from '../../components/ui/DataTable'
import { Badge } from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import PinGuard from '../../components/ui/PinGuard'
import { formatUGX } from '../../utils/formatters'
import { format } from 'date-fns'

export default function Staff() {
  const { staff, tasks, loadAll, getStats, addStaff, updateStaff, deleteStaff, addTask, updateTask, deleteTask, markAttendance } = useStaffStore()
  const [isStaffOpen, setIsStaffOpen] = useState(false)
  const [isTaskOpen, setIsTaskOpen] = useState(false)
  const [editingStaff, setEditingStaff] = useState(null)
  const [editingTask, setEditingTask] = useState(null)

  const [selectedStaff, setSelectedStaff] = useState(null)
  const [selectedTask, setSelectedTask] = useState(null)
  const [isStaffDeleteOpen, setIsStaffDeleteOpen] = useState(false)
  const [isTaskDeleteOpen, setIsTaskDeleteOpen] = useState(false)

  const initialStaffForm = { name: '', role: '', phone: '', salary: '', status: 'Active', joinDate: format(new Date(), 'yyyy-MM-dd') }
  const initialTaskForm = { title: '', staffId: '', priority: 'Medium', status: 'Pending', dueDate: format(new Date(), 'yyyy-MM-dd') }

  const [staffData, setStaffData] = useState(initialStaffForm)
  const [taskData, setTaskData] = useState(initialTaskForm)

  useEffect(() => { loadAll() }, [])

  const stats = getStats()

  const handleStaffSave = async (e) => {
    e.preventDefault()
    const payload = { ...staffData, salary: Number(staffData.salary) || 0 }
    if (editingStaff) {
      await updateStaff(editingStaff.id, payload)
    } else {
      await addStaff(payload)
    }
    setIsStaffOpen(false)
    setEditingStaff(null)
    setStaffData(initialStaffForm)
  }

  const handleTaskSave = async (e) => {
    e.preventDefault()
    const payload = { ...taskData, staffId: taskData.staffId }
    if (editingTask) {
      await updateTask(editingTask.id, payload)
    } else {
      await addTask(payload)
    }
    setIsTaskOpen(false)
    setEditingTask(null)
    setTaskData(initialTaskForm)
  }

  const staffCols = [
    { key: 'name', label: 'Name', render: (val, row) => (
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-slate-300">{val.charAt(0)}</div>
        <div><p className="font-medium text-white">{val}</p><p className="text-xs text-slate-400">{row.phone || '—'}</p></div>
      </div>
    )},
    { key: 'role', label: 'Role' },
    { key: 'salary', label: 'Salary', render: (val) => formatUGX(val) },
    { key: 'status', label: 'Status', render: (val) => <Badge variant={val === 'Active' ? 'green' : 'gray'}>{val}</Badge> },
    { key: 'attendance', label: 'Attendance (Today)', render: (_, row) => (
      <div className="flex gap-2">
        <button onClick={() => markAttendance({ staffId: row.id, date: format(new Date(), 'yyyy-MM-dd'), status: 'Present' })} className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded hover:bg-green-500/30">Present</button>
        <button onClick={() => markAttendance({ staffId: row.id, date: format(new Date(), 'yyyy-MM-dd'), status: 'Absent' })} className="text-xs px-2 py-1 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30">Absent</button>
      </div>
    )},
    { key: 'actions', label: 'Actions', sortable: false, render: (_, row) => (
      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
        <button onClick={() => {
          setEditingStaff(row)
          setStaffData({
            name: row.name,
            role: row.role,
            phone: row.phone || '',
            salary: String(row.salary),
            status: row.status,
            joinDate: row.joinDate
          })
          setIsStaffOpen(true)
        }} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white" title="Edit">
          <Edit2 size={14} />
        </button>
        <button onClick={() => { setSelectedStaff(row); setIsStaffDeleteOpen(true) }} className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400" title="Delete">
          <Trash2 size={14} />
        </button>
      </div>
    )}
  ]

  const taskCols = [
    { key: 'title', label: 'Task' },
    { key: 'staffId', label: 'Assigned To', render: (val) => staff.find(s => String(s.id) === String(val))?.name || 'Unassigned' },
    { key: 'priority', label: 'Priority', render: (val) => <Badge variant={val === 'High' ? 'red' : val === 'Medium' ? 'amber' : 'green'}>{val}</Badge> },
    { key: 'status', label: 'Status', render: (val) => <Badge variant={val === 'Completed' ? 'green' : 'gray'}>{val}</Badge> },
    { key: 'dueDate', label: 'Due Date', render: (val) => val ? format(new Date(val), 'dd MMM yyyy') : '—' },
    { key: 'actions', label: 'Actions', sortable: false, render: (_, row) => (
      <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
        {row.status !== 'Completed' && (
          <button onClick={() => updateTask(row.id, { ...row, status: 'Completed' })} className="p-1.5 rounded-lg hover:bg-green-500/20 text-green-400" title="Mark Completed">
            <CheckCircle2 size={14} />
          </button>
        )}
        <button onClick={() => {
          setEditingTask(row)
          setTaskData({
            title: row.title,
            staffId: row.staffId || '',
            priority: row.priority,
            status: row.status,
            dueDate: row.dueDate
          })
          setIsTaskOpen(true)
        }} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white" title="Edit">
          <Edit2 size={14} />
        </button>
        <button onClick={() => { setSelectedTask(row); setIsTaskDeleteOpen(true) }} className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400" title="Delete">
          <Trash2 size={14} />
        </button>
      </div>
    )}
  ]

  return (
    <PinGuard>
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Staff Management</h1>
          <p className="text-slate-400 text-sm mt-1">Manage personnel, attendance, and farm tasks.</p>
        </div>
        <button className="btn-primary" onClick={() => setIsStaffOpen(true)}><Plus size={16} /> Add Staff</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-4 flex items-center justify-between"><div><p className="text-xs text-slate-400">Total Staff</p><p className="text-2xl font-display font-bold text-white">{stats.total}</p></div></div>
        <div className="glass-card p-4 flex items-center justify-between"><div><p className="text-xs text-slate-400">Present Today</p><p className="text-2xl font-display font-bold text-green-400">{stats.present}</p></div></div>
        <div className="glass-card p-4 flex items-center justify-between"><div><p className="text-xs text-slate-400">Absent Today</p><p className="text-2xl font-display font-bold text-red-400">{stats.absent}</p></div></div>
        <div className="glass-card p-4 flex items-center justify-between"><div><p className="text-xs text-slate-400">Pending Tasks</p><p className="text-2xl font-display font-bold text-amber-400">{stats.pendingTasks}</p></div></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4"><h3 className="font-display font-semibold text-white">Staff Roster</h3></div>
          <DataTable columns={staffCols} data={staff} pageSize={6} />
        </div>
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-white">Tasks</h3>
            <button className="btn-secondary text-xs py-1.5 px-3" onClick={() => setIsTaskOpen(true)}>Assign Task</button>
          </div>
          <DataTable columns={taskCols} data={tasks} pageSize={6} />
        </div>
      </div>

      <Modal isOpen={isStaffOpen} onClose={() => { setIsStaffOpen(false); setEditingStaff(null); setStaffData(initialStaffForm) }} title={editingStaff ? "Edit Staff Member" : "Add Staff Member"}>
        <form onSubmit={handleStaffSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><label className="block text-xs font-medium text-slate-400 mb-1">Full Name *</label><input required type="text" className="input-field" value={staffData.name} onChange={e => setStaffData({...staffData, name: e.target.value})} /></div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Role *</label>
              <select required className="input-field" value={staffData.role} onChange={e => setStaffData({...staffData, role: e.target.value})}>
                <option value="">Select Role...</option><option>Manager</option><option>Veterinarian</option><option>Milker</option><option>Feeder</option><option>General Hand</option>
              </select>
            </div>
            <div><label className="block text-xs font-medium text-slate-400 mb-1">Phone Number</label><input type="text" className="input-field" value={staffData.phone} onChange={e => setStaffData({...staffData, phone: e.target.value})} /></div>
            <div><label className="block text-xs font-medium text-slate-400 mb-1">Monthly Salary (Ushs) *</label><input required type="number" className="input-field" value={staffData.salary} onChange={e => setStaffData({...staffData, salary: e.target.value})} /></div>
            <div><label className="block text-xs font-medium text-slate-400 mb-1">Join Date *</label><input required type="date" className="input-field" value={staffData.joinDate} onChange={e => setStaffData({...staffData, joinDate: e.target.value})} /></div>
            {editingStaff && (
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Status *</label>
                <select required className="input-field" value={staffData.status} onChange={e => setStaffData({...staffData, status: e.target.value})}>
                  <option>Active</option><option>Inactive</option>
                </select>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <button type="button" className="btn-secondary" onClick={() => { setIsStaffOpen(false); setEditingStaff(null); setStaffData(initialStaffForm) }}>Cancel</button>
            <button type="submit" className="btn-primary">Save Staff</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isTaskOpen} onClose={() => { setIsTaskOpen(false); setEditingTask(null); setTaskData(initialTaskForm) }} title={editingTask ? "Edit Task Assignment" : "Assign Task"}>
        <form onSubmit={handleTaskSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><label className="block text-xs font-medium text-slate-400 mb-1">Task Title *</label><input required type="text" className="input-field" value={taskData.title} onChange={e => setTaskData({...taskData, title: e.target.value})} placeholder="e.g. Repair fence in Section B" /></div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-400 mb-1">Assign To *</label>
              <select required className="input-field" value={taskData.staffId} onChange={e => setTaskData({...taskData, staffId: e.target.value})}>
                <option value="">Select Staff...</option>
                {staff.map(s => <option key={s.id} value={s.id}>{s.name} ({s.role})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Priority</label>
              <select className="input-field" value={taskData.priority} onChange={e => setTaskData({...taskData, priority: e.target.value})}>
                <option>Low</option><option>Medium</option><option>High</option>
              </select>
            </div>
            <div><label className="block text-xs font-medium text-slate-400 mb-1">Due Date *</label><input required type="date" className="input-field" value={taskData.dueDate} onChange={e => setTaskData({...taskData, dueDate: e.target.value})} /></div>
            {editingTask && (
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Status</label>
                <select className="input-field" value={taskData.status} onChange={e => setTaskData({...taskData, status: e.target.value})}>
                  <option>Pending</option><option>Completed</option>
                </select>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <button type="button" className="btn-secondary" onClick={() => { setIsTaskOpen(false); setEditingTask(null); setTaskData(initialTaskForm) }}>Cancel</button>
            <button type="submit" className="btn-primary">Assign Task</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={isStaffDeleteOpen} onClose={() => setIsStaffDeleteOpen(false)} onConfirm={() => { if(selectedStaff) deleteStaff(selectedStaff.id) }} title="Remove Staff Member?" message={`Are you sure you want to permanently remove ${selectedStaff?.name} from staff records?`} />
      <ConfirmDialog isOpen={isTaskDeleteOpen} onClose={() => setIsTaskDeleteOpen(false)} onConfirm={() => { if(selectedTask) deleteTask(selectedTask.id) }} title="Delete Task?" message={`Are you sure you want to permanently delete this task?`} />
    </div>
    </PinGuard>
  )
}
