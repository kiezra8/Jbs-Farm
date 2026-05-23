import { useState, useEffect } from 'react'
import { Save, Database, Key, Cloud, Shield, Download, Upload } from 'lucide-react'
import { db } from '../../db/schema'
import { initSupabase } from '../../services/syncEngine'
import { seedDatabase } from '../../db/seedData'

export default function Settings() {
  const [supabaseUrl, setSupabaseUrl] = useState('')
  const [supabaseKey, setSupabaseKey] = useState('')
  const [isSaved, setIsSaved] = useState(false)
  const [seeding, setSeeding] = useState(false)

  useEffect(() => {
    db.settings.get('supabaseUrl').then(v => { if(v) setSupabaseUrl(v.value) })
    db.settings.get('supabaseKey').then(v => { if(v) setSupabaseKey(v.value) })
  }, [])

  const handleSaveAuth = async (e) => {
    e.preventDefault()
    await db.settings.put({ key: 'supabaseUrl', value: supabaseUrl })
    await db.settings.put({ key: 'supabaseKey', value: supabaseKey })
    initSupabase(supabaseUrl, supabaseKey)
    setIsSaved(true)
    setTimeout(() => setIsSaved(false), 3000)
  }

  const handleSeed = async () => {
    setSeeding(true)
    await seedDatabase()
    setSeeding(false)
    window.location.reload()
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="page-header">
        <div>
          <h1 className="page-title">System Settings</h1>
          <p className="text-slate-400 text-sm mt-1">Configure cloud sync, security, and farm details.</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Cloud Sync Setup */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-6 border-b pb-4" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center border border-green-500/20">
              <Cloud className="text-green-400" />
            </div>
            <div>
              <h3 className="font-display font-semibold text-white">Cloud Sync (Supabase)</h3>
              <p className="text-xs text-slate-400">Enable automatic cloud backup</p>
            </div>
          </div>
          
          <form onSubmit={handleSaveAuth} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Project URL</label>
              <input type="text" value={supabaseUrl} onChange={e => setSupabaseUrl(e.target.value)} className="input-field" placeholder="https://xyzcompany.supabase.co" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Anon Key</label>
              <input type="password" value={supabaseKey} onChange={e => setSupabaseKey(e.target.value)} className="input-field" placeholder="eyJh..." />
            </div>
            <button type="submit" className="btn-primary w-full justify-center">
              {isSaved ? <Check size={16} /> : <Save size={16} />}
              {isSaved ? 'Saved!' : 'Save Configuration'}
            </button>
          </form>
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
            <button className="btn-danger w-full justify-between mt-2">
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
              <p className="text-xs text-slate-400">Manage offline access PIN</p>
            </div>
          </div>

          <form className="grid grid-cols-1 md:grid-cols-3 gap-4" onSubmit={e => e.preventDefault()}>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Current PIN</label>
              <input type="password" maxLength={6} className="input-field" placeholder="****" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">New PIN</label>
              <input type="password" maxLength={6} className="input-field" placeholder="****" />
            </div>
            <div className="flex items-end">
              <button className="btn-primary w-full justify-center">Change PIN</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
