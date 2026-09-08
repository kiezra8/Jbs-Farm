import { db } from '../db/schema'
import { getFirestoreDb } from './syncEngine'
import { doc, getDoc, setDoc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore'

const SETTINGS_KEY = 'historicalCowNames'

/**
 * Load the mapping of historical cow IDs to their names and tags.
 * Checks local IndexedDB settings first, then Firestore settings document.
 */
export async function loadHistoricalCowNames() {
  let mapping = {}
  try {
    const localSetting = await db.settings.get(SETTINGS_KEY)
    if (localSetting?.value) {
      mapping = { ...localSetting.value }
    }
  } catch (e) {
    console.warn('Could not read historicalCowNames from local db:', e)
  }

  // Also check Firestore if online
  try {
    const firestore = getFirestoreDb()
    if (firestore && navigator.onLine) {
      const snap = await getDoc(doc(firestore, 'settings', SETTINGS_KEY))
      if (snap.exists()) {
        const cloudMapping = snap.data()?.mapping || {}
        mapping = { ...mapping, ...cloudMapping }
        // Cache to local Dexie
        await db.settings.put({ key: SETTINGS_KEY, value: mapping })
      }
    }
  } catch (e) {
    console.warn('Could not sync historicalCowNames from firestore:', e)
  }

  return mapping
}

/**
 * Save or update names for one or more historical cows.
 * Updates local Dexie settings, Firestore settings, and backfills milkRecords.
 */
export async function saveHistoricalCowNames(updatedMap) {
  try {
    // 1. Get existing
    const current = await loadHistoricalCowNames()
    const merged = { ...current, ...updatedMap }

    // 2. Persist to Dexie settings
    await db.settings.put({ key: SETTINGS_KEY, value: merged })

    // 3. Persist to Firestore settings
    const firestore = getFirestoreDb()
    if (firestore && navigator.onLine) {
      try {
        await setDoc(doc(firestore, 'settings', SETTINGS_KEY), {
          mapping: merged,
          updatedAt: new Date().toISOString()
        })
      } catch (e) {
        console.warn('Firestore settings save warning:', e)
      }
    }

    // 4. Backfill local Dexie milkRecords
    for (const [animalId, info] of Object.entries(updatedMap)) {
      if (!animalId || !info) continue
      try {
        await db.milkRecords
          .where('animalId')
          .equals(animalId)
          .modify({
            animalName: info.name || '',
            tagNumber: info.tagNumber || ''
          })
      } catch (e) {
        console.warn(`Local milkRecords backfill failed for ${animalId}:`, e)
      }
    }

    // 5. Backfill Firestore milkRecords in batches
    if (firestore && navigator.onLine) {
      for (const [animalId, info] of Object.entries(updatedMap)) {
        if (!animalId || !info?.name) continue
        try {
          const q = query(collection(firestore, 'milkRecords'), where('animalId', '==', animalId))
          const snap = await getDocs(q)
          if (!snap.empty) {
            const batch = writeBatch(firestore)
            snap.forEach(d => {
              batch.update(d.ref, {
                animalName: info.name || '',
                tagNumber: info.tagNumber || ''
              })
            })
            await batch.commit()
          }
        } catch (e) {
          console.warn(`Firestore milkRecords backfill warning for ${animalId}:`, e)
        }
      }
    }

    return merged
  } catch (err) {
    console.error('Failed to save historical cow names:', err)
    throw err
  }
}

/**
 * Helper to build the unified cow list (combining active animals + previous animals with milk records).
 */
export function buildUnifiedCowList(animals = [], records = [], historicalNames = {}) {
  const activeIds = new Set(animals.map(a => String(a.id)))
  const unified = []

  // 1. Add all active female cows
  animals
    .filter(a => a.gender === 'Female' || !a.gender)
    .forEach(a => {
      unified.push({
        id: String(a.id),
        animalId: String(a.id),
        name: a.name || 'Unnamed',
        tagNumber: a.tagNumber || 'N/A',
        breed: a.breed || 'Dairy',
        isHistorical: false,
        status: a.status || 'Active'
      })
    })

  // 2. Discover all distinct cow IDs in milk records that are NOT in active animals
  const historicalMap = new Map() // id -> { count, total, firstDate, lastDate, sampleName, sampleTag }

  records.forEach(r => {
    const id = r.animalId ? String(r.animalId) : null
    if (!id || activeIds.has(id)) return

    if (!historicalMap.has(id)) {
      historicalMap.set(id, {
        id,
        count: 0,
        total: 0,
        firstDate: r.date,
        lastDate: r.date,
        sampleName: r.animalName || null,
        sampleTag: r.tagNumber || null
      })
    }
    const item = historicalMap.get(id)
    item.count++
    item.total += (Number(r.amount) || 0)
    if (r.animalName && !item.sampleName) item.sampleName = r.animalName
    if (r.tagNumber && !item.sampleTag) item.sampleTag = r.tagNumber
    if (r.date && r.date < item.firstDate) item.firstDate = r.date
    if (r.date && r.date > item.lastDate) item.lastDate = r.date
  })

  // Sort historical cows by total production descending
  const sortedHistorical = Array.from(historicalMap.values()).sort((a, b) => b.total - a.total)

  sortedHistorical.forEach((item, idx) => {
    const custom = historicalNames[item.id]
    const assignedName = custom?.name || item.sampleName
    const assignedTag = custom?.tagNumber || item.sampleTag
    const isNamed = Boolean(assignedName)

    unified.push({
      id: item.id,
      animalId: item.id,
      name: assignedName || `Previous Cow #${idx + 1}`,
      tagNumber: assignedTag || `OLD-${item.id.slice(0, 4).toUpperCase()}`,
      breed: custom?.breed || 'Dairy',
      isHistorical: true,
      isNamed,
      totalProduction: item.total,
      recordCount: item.count,
      firstDate: item.firstDate,
      lastDate: item.lastDate,
      status: 'Deleted/Previous Herd'
    })
  })

  return unified
}
