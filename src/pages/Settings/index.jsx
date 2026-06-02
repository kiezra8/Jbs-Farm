import { useState } from 'react'
import { Save, Database, Shield, Download, Upload, CheckCircle, Cloud } from 'lucide-react'
import { db } from '../../db/schema'
import { seedDatabase } from '../../db/seedData'
import { fetchAllFromFirebase, processSyncQueue } from '../../services/syncEngine'
import { useSyncStore } from '../../store/useSyncStore'
import PinGuard from '../../components/ui/PinGuard'

export default function Settings() {
  const [seeding, setSeeding] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')
  const { lastSynced, queueCount } = useSyncStore()

  const handleSeed = async () => {
    setSeeding(true)
    await seedDatabase()
    setSeeding(false)
    window.location.reload()
  }

  const handleManualSync = async () => {
    setSyncing(true)
    setSyncMsg('')
    try {
      await processSyncQueue()
      await fetchAllFromFirebase()
      setSyncMsg('Sync complete!')
    } catch (e) {
      setSyncMsg('Sync failed: ' + e.message)
    } finally {
      setSyncing(false)
      setTimeout(() => setSyncMsg(''), 4000)
    }
  }

  const handleClearData = async () => {
    if (!window.confirm('This will delete ALL local data. Are you sure?')) return
    const tables = [
      'animals','healthRecords','breedingRecords','milkRecords',
      'feedInventory','feedTransactions','finances','staff',
      'attendance','tasks','notifications','syncQueue','settings',
    ]
    for (const t of tables) await db[t].clear()
    window.location.reload()
  }

  return (
    <PinGuard>
    <div className="space-y-6 max-w-4xl">
      <div className="page-header">
        <div>
          <h1 className="page-title">System Settings</h1>
          <p className="text-slate-400 text-sm mt-1">Manage cloud sync, database, and farm security.</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">

        {/* Cloud Sync Status */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-6 border-b pb-4" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center border border-green-500/20">
              <Cloud className="text-green-400" />
            </div>
            <div>
              <h3 className="font-display font-semibold text-white">Cloud Sync</h3>
              <p className="text-xs text-slate-400">Firebase — shared across all devices</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Status</span>
              <span className={navigator.onLine ? 'text-green-400' : 'text-red-400'}>
                {navigator.onLine ? '🟢 Online' : '🔴 Offline'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Pending uploads</span>
              <span className={queueCount > 0 ? 'text-amber-400' : 'text-green-400'}>
                {queueCount} item{queueCount !== 1 ? 's' : ''}
              </span>
            </div>
            {lastSynced && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Last synced</span>
                <span className="text-slate-300">{new Date(lastSynced).toLocaleTimeString()}</span>
              </div>
            )}

            <button
              onClick={handleManualSync}
              disabled={syncing || !navigator.onLine}
              className="btn-primary w-full justify-center mt-4"
            >
              {syncing ? 'Syncing...' : '🔄 Sync Now'}
            </button>
            {syncMsg && (
              <p className="text-xs text-center text-green-400 mt-1">{syncMsg}</p>
            )}
            <p className="text-xs text-slate-500 mt-2 text-center">
              Cloud credentials are managed securely via environment variables.
            </p>
          </div>
        </div>

        {/* Database Management */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-6 border-b pb-4" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
              <Database className="text-blue-400" />
            </div>
            <div>
              <h3 className="font-display font-semibold text-white">Local Database</h3>
              <p className="text-xs text-slate-400">Manage offline storage (IndexedDB)</p>
            </div>
          </div>

          <div className="space-y-3">
            <button className="btn-secondary w-full justify-between group">
              <span className="flex items-center gap-2"><Download size={16} className="text-slate-400" /> Backup Local Data</span>
              <span className="text-xs text-slate-500 group-hover:text-white">Export JSON</span>
            </button>
            <button className="btn-secondary w-full justify-between group">
              <span className="flex items-center gap-2"><Upload size={16} className="text-slate-400" /> Restore Local Data</span>
              <span className="text-xs text-slate-500 group-hover:text-white">Import JSON</span>
            </button>
            <hr style={{ borderColor: 'rgba(255,255,255,0.05)' }} className="my-4" />
            <button onClick={handleSeed} disabled={seeding} className="btn-secondary w-full justify-between text-amber-400 hover:bg-amber-500/10 border-amber-500/20">
              <span>{seeding ? 'Generating...' : 'Load Dummy Data'}</span>
              <span className="text-xs">Fill DB with examples</span>
            </button>
            <button onClick={handleClearData} className="btn-danger w-full justify-between mt-2">
              <span>Clear Local Data</span>
              <span className="text-xs">Factory Reset</span>
            </button>
          </div>
        </div>

        {/* Security */}
        <div className="glass-card p-6 md:col-span-2">
          <div className="flex items-center gap-3 mb-6 border-b pb-4" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
              <Shield className="text-purple-400" />
            </div>
            <div>
              <h3 className="font-display font-semibold text-white">Security</h3>
              <p className="text-xs text-slate-400">PIN protects Finance, Staff, Analytics & Settings</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-3 glass-card p-4 border border-green-500/20 bg-green-500/5">
              <div className="flex items-center gap-2 text-green-400 text-sm">
                <CheckCircle size={16} />
                <span>Access PIN is active. Protected sections require PIN <strong>88888888</strong> to access.</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
    </PinGuard>
  )
}
