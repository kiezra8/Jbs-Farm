import { db } from '../db/schema'
import { getFirestoreDb } from './syncEngine'
import { doc, getDoc, setDoc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore'

const SETTINGS_KEY = 'historicalCowNames'

export const RECOVERED_HISTORICAL_COWS = {
  '63152c99-0f06-487f-8129-7d14c2ddb262': { name: 'Tali', tagNumber: "JB's 001", breed: 'Friesian' },
  '284857c2-ffa7-4434-8268-76cd1c7fd354': { name: 'Lucky', tagNumber: '012', breed: 'Friesian' },
  'dd732116-d45e-4f6d-b79c-7a998eb4b2ed': { name: 'Kerry', tagNumber: '018', breed: 'Friesian' },
  'c886d9da-0a13-4f9d-a748-9a20b3c2f10d': { name: 'Pearl', tagNumber: 'JB 003', breed: 'Friesian' },
  '98763729-c2bc-4d15-83bd-abb20e54480c': { name: 'Mukonjo', tagNumber: '010', breed: 'Friesian' },
  '1952681a-948f-40d7-be45-9a785ee85bdf': { name: 'Stacy', tagNumber: '008', breed: 'Friesian' },
  'c92431c6-61eb-453e-aefb-0247592aaa51': { name: 'Queen', tagNumber: '061', breed: 'Friesian' },
  '05d0911b-e583-4f80-b2e4-51a01cae6144': { name: 'Mulefu', tagNumber: '025', breed: 'Friesian' },
  '64156c51-2558-4c4b-9125-a2eedab6d815': { name: 'Eliza', tagNumber: '019', breed: 'Friesian' },
  'eea3f603-fbd4-4f6a-ab22-b5eec1fe4727': { name: 'Super', tagNumber: '027', breed: 'Friesian' },
  '8dd35b73-bdb1-44a0-9b2b-c2e20f7939eb': { name: 'Angel', tagNumber: '026', breed: 'Friesian' },
  '390eb867-dc40-4123-9fdf-12c188f83354': { name: 'Falcon', tagNumber: '020', breed: 'Friesian' },
  '562ec4bf-7e2d-4097-81c6-1308d482da7a': { name: 'Lwasau', tagNumber: '024', breed: 'Friesian' },
  '5ea7620b-ae6f-4f0c-85e5-f1ee2cba7dca': { name: 'Delta', tagNumber: '022', breed: 'Friesian' },
  '35f96450-e4b4-4caf-b409-d5915b417796': { name: 'Mwinza', tagNumber: '015', breed: 'Friesian' },
  'a67bf2fe-bac9-40b8-8e35-ca3216e50305': { name: 'Maggie', tagNumber: '007', breed: 'Friesian' },
  'e5f5c527-e239-4e08-bf58-ce4c6d8c2a9a': { name: 'New Stock', tagNumber: '028', breed: 'Friesian' },
  '9ac67bbf-b0f8-41de-8dec-3474513c097f': { name: 'Tina', tagNumber: "JB's 002", breed: 'Friesian' },
  '5a586c21-44ae-4774-86f8-76ca201521e4': { name: 'Buntu', tagNumber: '013', breed: 'Friesian' },
  '8dfb74c1-f493-4a86-9116-ce94122ba966': { name: 'Alpha', tagNumber: '021', breed: 'Friesian' },
  '40b1f92a-9074-4600-8831-6610e4727d80': { name: 'Super 1', tagNumber: '01f', breed: 'Friesian' },
  '58d18644-4c06-401d-abdc-4e36d96ca100': { name: 'Blackie', tagNumber: '004', breed: 'Friesian' }
}

/**
 * Load the mapping of historical cow IDs to their names and tags.
 * Pre-seeds with recovered genuine farm cow names, then merges with local/cloud mappings.
 */
export async function loadHistoricalCowNames() {
  let mapping = { ...RECOVERED_HISTORICAL_COWS }
  try {
    const localSetting = await db.settings.get(SETTINGS_KEY)
    if (localSetting?.value) {
      mapping = { ...mapping, ...localSetting.value }
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
    const recovered = RECOVERED_HISTORICAL_COWS[item.id]
    const custom = historicalNames[item.id]
    const assignedName = custom?.name || item.sampleName || recovered?.name
    const assignedTag = custom?.tagNumber || item.sampleTag || recovered?.tagNumber
    const assignedBreed = custom?.breed || recovered?.breed || 'Friesian'
    const isNamed = Boolean(assignedName)

    unified.push({
      id: item.id,
      animalId: item.id,
      name: assignedName || `Previous Cow #${idx + 1}`,
      tagNumber: assignedTag || `OLD-${item.id.slice(0, 4).toUpperCase()}`,
      breed: assignedBreed,
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
