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
let skipHooks = {}
let isSyncingAll = false

// ─── Pull ALL Sacco Data from Supabase into local IndexedDB ─────────────────
export async function fetchAllSaccoFromSupabase() {
  if (isSyncingAll) return
  isSyncingAll = true
  console.log('⬇  Fetching Sacco data from Supabase...')

  // Prevent local auto-creation or writes from triggering writes back to Supabase
  SACCO_TABLES.forEach(t => { skipHooks[t] = true })

  try {
    for (const dexieTable of SACCO_TABLES) {
      const sbTable = TABLE_MAP[dexieTable]
      try {
        // Paginate through ALL rows — Supabase defaults to 1000 row limit per request
        let allData = []
        let from = 0
        const PAGE_SIZE = 1000

        while (true) {
          const { data, error } = await supabase
            .from(sbTable)
            .select('*')
            .range(from, from + PAGE_SIZE - 1)

          if (error) {
            console.warn(`⚠️ Could not fetch ${sbTable} (page starting ${from}):`, error.message)
            break
          }

          if (!data || data.length === 0) break

          allData = allData.concat(data)

          // If we got fewer rows than PAGE_SIZE we've reached the end
          if (data.length < PAGE_SIZE) break

          from += PAGE_SIZE
        }

        if (allData.length > 0) {
          const cleanData = allData.map(record => {
            const cleanRecord = { ...record }
            if (dexieTable === 'saccoMembers' && typeof cleanRecord.category === 'string') {
              try {
                if (cleanRecord.category.trim().startsWith('[')) {
                  cleanRecord.category = JSON.parse(cleanRecord.category)
                } else {
                  cleanRecord.category = cleanRecord.category.split(',').map(c => c.trim()).filter(Boolean)
                }
              } catch (_) {
                cleanRecord.category = [cleanRecord.category]
              }
            }
            return cleanRecord
          })
          await db[dexieTable].bulkPut(cleanData)
          console.log(`✅ Loaded ${cleanData.length} records into local [${dexieTable}]`)
        }
      } catch (e) {
        console.error(`Error loading ${dexieTable}:`, e)
      }
    }

    // Notify Sacco store to refresh its UI state only once after all tables are loaded
    try {
      const { useSaccoStore } = await import('../store/useSaccoStore')
      const state = useSaccoStore.getState()
      if (typeof state.loadSaccoData === 'function') {
        await state.loadSaccoData()
      }
    } catch (_) {}

  } finally {
    SACCO_TABLES.forEach(t => { skipHooks[t] = false })
    isSyncingAll = false
  }

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
        
        // Clean columns to avoid foreign key issues or extra property issues
        const cleanChunk = chunk.map(record => {
          const cleanRecord = { ...record }
          // If category is string in IndexedDB (from legacy data), convert it to array for JSONB column compatibility
          if (dexieTable === 'saccoMembers' && typeof cleanRecord.category === 'string') {
            cleanRecord.category = [cleanRecord.category]
          }
          return cleanRecord
        })

        const { error } = await supabase
          .from(sbTable)
          .upsert(cleanChunk, { onConflict: 'id' })

        if (error) {
          console.error(`❌ Upsert failed for ${sbTable} chunk ${i}:`, error.message)
          throw new Error(`Table "${sbTable}" failed: ${error.message}`)
        } else {
          grandTotal += cleanChunk.length
        }
      }
      console.log(`✅ Pushed ${records.length} records to Supabase [${sbTable}]`)
    } catch (e) {
      console.error(`Error pushing ${dexieTable}:`, e)
      throw e // rethrow to bubble up to UI
    }
  }

  console.log(`🚀 Sacco push complete! Total records sent: ${grandTotal}`)
  return grandTotal
}

// ─── Upsert a single Sacco record to Supabase ───────────────────────────────
export async function upsertSaccoRecord(dexieTable, record) {
  if (!record || !record.id || skipHooks[dexieTable] || isSyncingAll) return
  const sbTable = TABLE_MAP[dexieTable]
  if (!sbTable) return

  try {
    const cleanRecord = { ...record }
    if (dexieTable === 'saccoMembers' && typeof cleanRecord.category === 'string') {
      cleanRecord.category = [cleanRecord.category]
    }

    const { error } = await supabase
      .from(sbTable)
      .upsert(cleanRecord, { onConflict: 'id' })
    if (error) {
      console.warn(`⚠️ Supabase upsert failed for ${sbTable}:`, error.message)
    }
  } catch (e) {
    console.warn(`upsertSaccoRecord error (${sbTable}):`, e)
  }
}

// ─── Delete a single Sacco record from Supabase ─────────────────────────────
export async function deleteSaccoRecord(dexieTable, id) {
  if (skipHooks[dexieTable] || isSyncingAll) return
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
          skipHooks[dexieTable] = true
          try {
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              const record = { ...payload.new }
              if (dexieTable === 'saccoMembers' && typeof record.category === 'string') {
                try {
                  if (record.category.trim().startsWith('[')) {
                    record.category = JSON.parse(record.category)
                  } else {
                    record.category = record.category.split(',').map(c => c.trim()).filter(Boolean)
                  }
                } catch (_) {
                  record.category = [record.category]
                }
              }
              await db[dexieTable].put(record)
            } else if (payload.eventType === 'DELETE') {
              await db[dexieTable].delete(payload.old.id)
            }

            // Reload Sacco UI
            const { useSaccoStore } = await import('../store/useSaccoStore')
            const state = useSaccoStore.getState()
            if (typeof state.loadSaccoData === 'function') {
              await state.loadSaccoData()
            }
          } catch (e) {
            console.warn(`Realtime error on ${sbTable}:`, e)
          } finally {
            skipHooks[dexieTable] = false
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
      if (skipHooks[dexieTable] || isSyncingAll) return
      this.onsuccess = function (generatedKey) {
        upsertSaccoRecord(dexieTable, { ...obj, id: generatedKey })
      }
    })

    // UPDATE
    db[dexieTable].hook('updating', function (mods, primKey, obj) {
      if (skipHooks[dexieTable] || isSyncingAll) return
      const fullRecord = { ...obj, ...mods }
      this.onsuccess = function () {
        upsertSaccoRecord(dexieTable, fullRecord)
      }
    })

    // DELETE
    db[dexieTable].hook('deleting', function (primKey) {
      if (skipHooks[dexieTable] || isSyncingAll) return
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
