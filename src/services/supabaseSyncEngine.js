/**
 * supabaseSyncEngine.js
 *
 * Handles all Sacco data sync via Supabase (PostgreSQL).
 * Firebase is NOT used for Sacco tables anymore.
 *
 * Tables handled:
 *   saccoMembers, saccoShares, saccoInvestors,
 *   saccoTransactions, saccoSavings, saccoYearlySavings
 */

import { db } from '../db/schema'
import { supabase } from './supabaseClient'

const SACCO_TABLES = [
  'saccoMembers',
  'saccoShares',
  'saccoInvestors',
  'saccoTransactions',
  'saccoSavings',
  'saccoYearlySavings',
]

// Supabase table names (same as Dexie table names)
const TABLE_MAP = {
  saccoMembers:       'saccoMembers',
  saccoShares:        'saccoShares',
  saccoInvestors:     'saccoInvestors',
  saccoTransactions:  'saccoTransactions',
  saccoSavings:       'saccoSavings',
  saccoYearlySavings: 'saccoYearlySavings',
}

let realtimeChannels = []

// ─── Pull ALL Sacco Data from Supabase into local IndexedDB ─────────────────
export async function fetchAllSaccoFromSupabase() {
  console.log('⬇️  Fetching Sacco data from Supabase...')

  for (const dexieTable of SACCO_TABLES) {
    const sbTable = TABLE_MAP[dexieTable]
    try {
      const { data, error } = await supabase.from(sbTable).select('*')
      if (error) {
        console.warn(`⚠️ Could not fetch ${sbTable}:`, error.message)
        continue
      }
      if (data && data.length > 0) {
        await db[dexieTable].bulkPut(data)
        console.log(`✅ Loaded ${data.length} records into local [${dexieTable}]`)
      }
    } catch (e) {
      console.error(`Error loading ${dexieTable}:`, e)
    }
  }

  // Notify Sacco store to refresh its UI state
  try {
    const { useSaccoStore } = await import('../store/useSaccoStore')
    const state = useSaccoStore.getState()
    if (typeof state.loadSaccoData === 'function') {
      await state.loadSaccoData()
    }
  } catch (_) {}

  console.log('✅ Sacco data loaded from Supabase.')
}

// ─── Push ALL local Sacco data to Supabase ──────────────────────────────────
export async function forceUploadSaccoToSupabase() {
  console.log('⬆️  Pushing all local Sacco data to Supabase...')

  let grandTotal = 0
  for (const dexieTable of SACCO_TABLES) {
    const sbTable = TABLE_MAP[dexieTable]
    try {
      const records = await db[dexieTable].toArray()
      if (records.length === 0) continue

      // Supabase upsert handles inserts + updates gracefully
      // Process in chunks of 500 to avoid request size limits
      for (let i = 0; i < records.length; i += 500) {
        const chunk = records.slice(i, i + 500)
        const { error } = await supabase
          .from(sbTable)
          .upsert(chunk, { onConflict: 'id' })

        if (error) {
          console.error(`❌ Upsert failed for ${sbTable} chunk ${i}:`, error.message)
        } else {
          grandTotal += chunk.length
        }
      }
      console.log(`✅ Pushed ${records.length} records to Supabase [${sbTable}]`)
    } catch (e) {
      console.error(`Error pushing ${dexieTable}:`, e)
    }
  }

  console.log(`🚀 Sacco push complete! Total records sent: ${grandTotal}`)
  return grandTotal
}

// ─── Upsert a single Sacco record to Supabase ───────────────────────────────
export async function upsertSaccoRecord(dexieTable, record) {
  if (!record || !record.id) return
  const sbTable = TABLE_MAP[dexieTable]
  if (!sbTable) return

  try {
    const { error } = await supabase
      .from(sbTable)
      .upsert(record, { onConflict: 'id' })
    if (error) {
      console.warn(`⚠️ Supabase upsert failed for ${sbTable}:`, error.message)
    }
  } catch (e) {
    console.warn(`upsertSaccoRecord error (${sbTable}):`, e)
  }
}

// ─── Delete a single Sacco record from Supabase ─────────────────────────────
export async function deleteSaccoRecord(dexieTable, id) {
  const sbTable = TABLE_MAP[dexieTable]
  if (!sbTable) return

  try {
    const { error } = await supabase.from(sbTable).delete().eq('id', id)
    if (error) {
      console.warn(`⚠️ Supabase delete failed for ${sbTable}:`, error.message)
    }
  } catch (e) {
    console.warn(`deleteSaccoRecord error (${sbTable}):`, e)
  }
}

// ─── Setup Supabase Realtime listeners for all Sacco tables ─────────────────
export function initSupabaseSaccoSync() {
  // Tear down any old channels first
  realtimeChannels.forEach(ch => supabase.removeChannel(ch))
  realtimeChannels = []

  for (const dexieTable of SACCO_TABLES) {
    const sbTable = TABLE_MAP[dexieTable]

    const channel = supabase
      .channel(`realtime-${sbTable}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: sbTable },
        async (payload) => {
          try {
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              await db[dexieTable].put(payload.new)
            } else if (payload.eventType === 'DELETE') {
              await db[dexieTable].delete(payload.old.id)
            }

            // Reload Sacco UI
            const { useSaccoStore } = await import('../store/useSaccoStore')
            const state = useSaccoStore.getState()
            if (typeof state.loadSaccoData === 'function') {
              state.loadSaccoData()
            }
          } catch (e) {
            console.warn(`Realtime error on ${sbTable}:`, e)
          }
        }
      )
      .subscribe()

    realtimeChannels.push(channel)
  }

  console.log('✅ Supabase realtime sync initialized for Sacco tables.')
}

// ─── Setup Dexie hooks for Sacco tables to auto-push to Supabase ────────────
let saccoHooksInitialized = false
export function setupSaccoDexieHooks() {
  if (saccoHooksInitialized) return
  saccoHooksInitialized = true

  for (const dexieTable of SACCO_TABLES) {
    // CREATE
    db[dexieTable].hook('creating', function (primKey, obj) {
      this.onsuccess = function (generatedKey) {
        upsertSaccoRecord(dexieTable, { ...obj, id: generatedKey })
      }
    })

    // UPDATE
    db[dexieTable].hook('updating', function (mods, primKey, obj) {
      const fullRecord = { ...obj, ...mods }
      this.onsuccess = function () {
        upsertSaccoRecord(dexieTable, fullRecord)
      }
    })

    // DELETE
    db[dexieTable].hook('deleting', function (primKey) {
      this.onsuccess = function () {
        deleteSaccoRecord(dexieTable, primKey)
      }
    })
  }

  console.log('✅ Sacco Dexie hooks wired to Supabase.')
}

// ─── Main init: call this from App.jsx alongside initSyncEngine() ────────────
export function initSaccoSync() {
  setupSaccoDexieHooks()
  initSupabaseSaccoSync()

  if (navigator.onLine) {
    fetchAllSaccoFromSupabase()
  }

  window.addEventListener('online', () => {
    fetchAllSaccoFromSupabase()
  })

  window.addEventListener('focus', () => {
    if (navigator.onLine) fetchAllSaccoFromSupabase()
  })

  // Expose push helper globally for emergency manual syncs
  window.pushSaccoToCloud = forceUploadSaccoToSupabase
}
