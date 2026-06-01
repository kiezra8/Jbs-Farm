import { db } from '../db/schema'
import { useSyncStore } from '../store/useSyncStore'
import { createClient } from '@supabase/supabase-js'

let supabase = null

// Prevents hooks from re-queuing data that came FROM Supabase
let skipHooks = false

// Prevents hooks from being registered more than once
let hooksInitialized = false

export function initSupabase(url, key) {
  try {
    if (url && key) {
      supabase = createClient(url, key)
      return true
    }
  } catch (e) {
    console.warn('Supabase init failed:', e)
  }
  return false
}

export function getSupabase() { return supabase }

// All tables that get synced — Dexie name : Supabase table name
const SYNC_TABLES = {
  animals:          'animals',
  healthRecords:    'healthRecords',
  breedingRecords:  'breedingRecords',
  milkRecords:      'milkRecords',
  feedInventory:    'feedInventory',
  feedTransactions: 'feedTransactions',
  finances:         'finances',
  staff:            'staff',
  attendance:       'attendance',
  tasks:            'tasks',
  notifications:    'notifications',
}

// ─── Pull ALL data from Supabase into local IndexedDB ─────────────
// Called on app start when online — ensures every user sees shared data
export async function fetchAllFromSupabase() {
  if (!supabase) return
  console.log('⬇️  Pulling data from Supabase...')

  skipHooks = true   // stop hooks from re-queuing Supabase data back up
  try {
    for (const [dexieTable, supabaseTable] of Object.entries(SYNC_TABLES)) {
      try {
        const { data, error } = await supabase
          .from(supabaseTable)
          .select('*')
          .order('id', { ascending: true })

        if (error) {
          console.warn(`Supabase fetch failed for ${supabaseTable}:`, error.message)
          continue
        }

        if (data && data.length > 0) {
          // bulkPut merges cloud records into local — safe, non-destructive
          await db[dexieTable].bulkPut(data)
        }
      } catch (e) {
        console.warn(`Could not sync ${dexieTable}:`, e.message)
      }
    }

    useSyncStore.getState().setLastSynced(new Date().toISOString())
    console.log('✅ Supabase sync complete')
  } finally {
    skipHooks = false
  }
}

// ─── Add a single record change to the local pending queue ────────
export async function addToSyncQueue(table, operation, recordId, data) {
  try {
    await db.syncQueue.add({
      table,
      operation,
      recordId,
      data: JSON.stringify(data),
      status: 'pending',
      createdAt: new Date().toISOString(),
    })
    useSyncStore.getState().incrementQueue()

    // Immediately attempt to flush the queue if we are online
    if (navigator.onLine && supabase) {
      processSyncQueue()
    }
  } catch (e) {
    console.warn('addToSyncQueue error:', e)
  }
}

// ─── Push all pending local changes up to Supabase ────────────────
export async function processSyncQueue() {
  if (!supabase) return
  const store = useSyncStore.getState()
  if (!store.isOnline || store.isSyncing) return

  const pending = await db.syncQueue
    .where('status').anyOf('pending', 'error')
    .toArray()

  if (pending.length === 0) return

  store.setSyncing(true)
  store.setSyncError(null)

  try {
    for (const item of pending) {
      try {
        if (item.operation === 'upsert') {
          const data = JSON.parse(item.data)
          if (!data) continue
          const { error } = await supabase.from(item.table).upsert(data)
          if (error) throw error
        } else if (item.operation === 'delete') {
          const { error } = await supabase
            .from(item.table)
            .delete()
            .eq('id', item.recordId)
          if (error) throw error
        }

        await db.syncQueue.update(item.id, { status: 'synced' })
        store.decrementQueue()
      } catch (e) {
        console.error(`Sync failed for [${item.table}] id=${item.recordId}:`, e.message)
        await db.syncQueue.update(item.id, { status: 'error', error: e.message })
      }
    }

    store.setLastSynced(new Date().toISOString())
  } catch (e) {
    store.setSyncError(e.message)
  } finally {
    store.setSyncing(false)
  }
}

// ─── Dexie table hooks — intercept every local write ──────────────
export function setupDexieHooks() {
  if (hooksInitialized) return
  hooksInitialized = true

  Object.keys(SYNC_TABLES).forEach(table => {
    // CREATE — a new record was inserted locally
    db[table].hook('creating', function (primKey, obj, trans) {
      this.onsuccess = function (generatedKey) {
        if (skipHooks) return
        addToSyncQueue(table, 'upsert', generatedKey, { ...obj, id: generatedKey })
      }
    })

    // UPDATE — an existing record was modified locally
    // IMPORTANT: onsuccess receives nothing useful; capture mods+obj BEFORE it fires
    db[table].hook('updating', function (mods, primKey, obj) {
      const fullRecord = { ...obj, ...mods }   // reconstruct the updated record
      this.onsuccess = function () {
        if (skipHooks) return
        addToSyncQueue(table, 'upsert', primKey, fullRecord)
      }
    })

    // DELETE — a record was removed locally
    db[table].hook('deleting', function (primKey) {
      this.onsuccess = function () {
        if (skipHooks) return
        addToSyncQueue(table, 'delete', primKey, null)
      }
    })
  })
}

// ─── Bootstrap: call this once from App.jsx ───────────────────────
export function initSyncEngine() {
  const store = useSyncStore.getState()

  setupDexieHooks()

  const handleOnline = () => {
    store.setOnline(true)
    // When connection is restored: push local changes, then pull latest from cloud
    processSyncQueue().then(() => fetchAllFromSupabase())
  }
  const handleOffline = () => store.setOnline(false)
  const handleFocus = () => {
    if (navigator.onLine && supabase) {
      processSyncQueue().then(() => fetchAllFromSupabase())
    }
  }

  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)
  window.addEventListener('focus', handleFocus)
  store.setOnline(navigator.onLine)

  // Count any existing pending items from previous sessions
  db.syncQueue
    .where('status').anyOf('pending', 'error')
    .count()
    .then(n => store.setQueueCount(n))

  // Auto-sync every 2 minutes when online
  const interval = setInterval(() => {
    if (navigator.onLine && supabase) {
      processSyncQueue().then(() => fetchAllFromSupabase())
    }
  }, 2 * 60 * 1000)

  return () => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
    window.removeEventListener('focus', handleFocus)
    clearInterval(interval)
  }
}
