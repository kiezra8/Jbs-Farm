import { db } from '../db/schema'
import { useSyncStore } from '../store/useSyncStore'
import { initializeApp } from 'firebase/app'
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyBtBDImA3JxW6drta2qG8Kacx4lk7yG85M",
  authDomain: "erands-guy.firebaseapp.com",
  projectId: "erands-guy",
  storageBucket: "erands-guy.firebasestorage.app",
  messagingSenderId: "184159634431",
  appId: "1:184159634431:web:a5a2f328444104562a1dca",
  measurementId: "G-29GWN7E6C6"
};

let firestore = null

// Prevents hooks from re-queuing data that came FROM Firebase
let skipHooks = false

// Prevents hooks from being registered more than once
let hooksInitialized = false

export function initFirebase() {
  try {
    const app = initializeApp(firebaseConfig)
    firestore = getFirestore(app)
    return true
  } catch (e) {
    console.warn('Firebase init failed:', e)
  }
  return false
}

export function getFirestoreDb() { return firestore }

// All tables that get synced — Dexie name : Firebase collection name
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

// ─── Pull ALL data from Firebase into local IndexedDB ─────────────
// Called on app start when online — ensures every user sees shared data
export async function fetchAllFromFirebase() {
  if (!firestore) return
  console.log('⬇️  Pulling data from Firebase...')

  skipHooks = true   // stop hooks from re-queuing Firebase data back up
  try {
    for (const [dexieTable, firebaseCollection] of Object.entries(SYNC_TABLES)) {
      try {
        const querySnapshot = await getDocs(collection(firestore, firebaseCollection))
        const data = []
        querySnapshot.forEach((docSnap) => {
          data.push(docSnap.data())
        })

        if (data.length > 0) {
          data.sort((a, b) => (a.id > b.id ? 1 : -1))
          // bulkPut merges cloud records into local — safe, non-destructive
          await db[dexieTable].bulkPut(data)
        }
      } catch (e) {
        console.warn(`Could not sync ${dexieTable}:`, e.message)
      }
    }

    useSyncStore.getState().setLastSynced(new Date().toISOString())
    console.log('✅ Firebase sync complete')
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
    if (navigator.onLine && firestore) {
      processSyncQueue()
    }
  } catch (e) {
    console.warn('addToSyncQueue error:', e)
  }
}

// ─── Push all pending local changes up to Firebase ────────────────
export async function processSyncQueue() {
  if (!firestore) return
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
          await setDoc(doc(firestore, item.table, String(item.recordId)), data, { merge: true })
        } else if (item.operation === 'delete') {
          await deleteDoc(doc(firestore, item.table, String(item.recordId)))
        }

        await db.syncQueue.update(item.id, { status: 'synced' })
        store.decrementQueue()
      } catch (e) {
        console.error(`Sync failed for [${item.table}] id=${item.recordId}:`, e.message)
        await db.syncQueue.update(item.id, { status: 'error', error: e.message })
        store.setSyncError(e.message)
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
    processSyncQueue().then(() => fetchAllFromFirebase())
  }
  const handleOffline = () => store.setOnline(false)
  const handleFocus = () => {
    if (navigator.onLine && firestore) {
      processSyncQueue().then(() => fetchAllFromFirebase())
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
    if (navigator.onLine && firestore) {
      processSyncQueue().then(() => fetchAllFromFirebase())
    }
  }, 2 * 60 * 1000)

  return () => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
    window.removeEventListener('focus', handleFocus)
    clearInterval(interval)
  }
}
