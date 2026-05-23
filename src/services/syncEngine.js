import { db } from '../db/schema'
import { useSyncStore } from '../store/useSyncStore'
import { createClient } from '@supabase/supabase-js'

let supabase = null

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

// ─── Sync Engine ──────────────────────────────────────────────────
export async function addToSyncQueue(table, operation, recordId, data) {
  await db.syncQueue.add({
    table, operation, recordId,
    data: JSON.stringify(data),
    status: 'pending',
    createdAt: new Date().toISOString(),
  })
  useSyncStore.getState().incrementQueue()
  
  // Try sync immediately if online
  if (navigator.onLine) {
    processSyncQueue()
  }
}

export async function processSyncQueue() {
  if (!supabase) return
  const store = useSyncStore.getState()
  if (!store.isOnline || store.isSyncing) return

  const pending = await db.syncQueue.where('status').equals('pending').toArray()
  if (pending.length === 0) return

  store.setSyncing(true)
  store.setSyncError(null)

  try {
    for (const item of pending) {
      const data = JSON.parse(item.data)
      try {
        if (item.operation === 'upsert') {
          // Send to supabase
          const { error } = await supabase.from(item.table).upsert(data)
          if (error) throw error
        } else if (item.operation === 'delete') {
          const { error } = await supabase.from(item.table).delete().eq('id', item.recordId)
          if (error) throw error
        }
        await db.syncQueue.update(item.id, { status: 'synced' })
        store.decrementQueue()
      } catch (e) {
        console.error('Sync Error for item', item, e)
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

export function initSyncEngine() {
  const store = useSyncStore.getState()

  const handleOnline = () => {
    store.setOnline(true)
    processSyncQueue()
  }
  const handleOffline = () => store.setOnline(false)

  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)
  store.setOnline(navigator.onLine)

  // Count existing pending items
  db.syncQueue.where('status').equals('pending').count().then(n => {
    store.setQueueCount(n)
  })

  // Auto-sync every 5 minutes when online
  const interval = setInterval(() => {
    if (navigator.onLine) processSyncQueue()
  }, 5 * 60 * 1000)

  return () => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
    clearInterval(interval)
  }
}
