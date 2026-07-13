import Dexie from 'dexie'

export const db = new Dexie('JBSFarmDB_v2')

// ─── Version 1: UUID string IDs for multi-device sync without collisions ─────
db.version(1).stores({
  animals:          'id, tagNumber, name, breed, gender, status, createdAt, updatedAt',
  healthRecords:    'id, animalId, type, date, createdAt, updatedAt',
  breedingRecords:  'id, animalId, type, date, status, createdAt, updatedAt',
  milkRecords:      'id, animalId, date, session, createdAt',
  feedInventory:    'id, feedType, updatedAt',
  feedTransactions: 'id, feedType, type, date, createdAt',
  finances:         'id, category, type, date, createdAt',
  staff:            'id, name, role, status, createdAt',
  attendance:       'id, staffId, date, status, createdAt',
  tasks:            'id, staffId, status, dueDate, createdAt',
  notifications:    'id, type, read, createdAt',
  syncQueue:        '++id, table, operation, recordId, data, status, createdAt',
  settings:         'key',
})

// ─── Version 2: Add SACCO tables ─────────────────────────────────────────────
db.version(2).stores({
  animals:          'id, tagNumber, name, breed, gender, status, createdAt, updatedAt',
  healthRecords:    'id, animalId, type, date, createdAt, updatedAt',
  breedingRecords:  'id, animalId, type, date, status, createdAt, updatedAt',
  milkRecords:      'id, animalId, date, session, createdAt',
  feedInventory:    'id, feedType, updatedAt',
  feedTransactions: 'id, feedType, type, date, createdAt',
  finances:         'id, category, type, date, createdAt',
  staff:            'id, name, role, status, createdAt',
  attendance:       'id, staffId, date, status, createdAt',
  tasks:            'id, staffId, status, dueDate, createdAt',
  notifications:    'id, type, read, createdAt',
  syncQueue:        '++id, table, operation, recordId, data, status, createdAt',
  settings:         'key',
  saccoMembers:     'id, name, phone, nin, category, photo, createdAt',
  saccoShares:      'id, memberId, shareCount, createdAt',
  saccoInvestors:   'id, memberId, category, moneyMakerAmount, cowsPerYear, createdAt',
  saccoTransactions: 'id, date, type, source, category, amount, createdAt'
})

// ─── Version 5: Multiple categories and Investor fields ───────────────────
db.version(5).stores({
  animals:          'id, tagNumber, name, breed, gender, status, createdAt, updatedAt',
  healthRecords:    'id, animalId, type, date, createdAt, updatedAt',
  breedingRecords:  'id, animalId, type, date, status, createdAt, updatedAt',
  milkRecords:      'id, animalId, date, session, createdAt',
  feedInventory:    'id, feedType, updatedAt',
  feedTransactions: 'id, feedType, type, date, createdAt',
  finances:         'id, category, type, date, createdAt',
  staff:            'id, name, role, status, createdAt',
  attendance:       'id, staffId, date, status, createdAt',
  tasks:            'id, staffId, status, dueDate, createdAt',
  notifications:    'id, type, read, createdAt',
  syncQueue:        '++id, table, operation, recordId, data, status, createdAt',
  settings:         'key',
  saccoMembers:     'id, name, phone, nin, category, photo, correctBalance, jan, feb, mar, apr, may, jun, jul, aug, sep, oct, nov, dec, total, shares, admin, savings, mandatory, withdrawable, requested, difference, noOfShares, createdAt',
  saccoShares:      'id, memberId, shareCount, createdAt',
  saccoInvestors:   'id, memberId, category, investorType, investmentPhase, marketingStrategy, moneyMakerAmount, cowsPerYear, createdAt',
  saccoTransactions: 'id, date, type, source, category, amount, createdAt',
  saccoSavings:     'id, memberId, savingAmount, updatedAt'
})

// ─── Version 6: Add saccoYearlySavings table for multiple years ──────────
db.version(6).stores({
  animals:          'id, tagNumber, name, breed, gender, status, createdAt, updatedAt',
  healthRecords:    'id, animalId, type, date, createdAt, updatedAt',
  breedingRecords:  'id, animalId, type, date, status, createdAt, updatedAt',
  milkRecords:      'id, animalId, date, session, createdAt',
  feedInventory:    'id, feedType, updatedAt',
  feedTransactions: 'id, feedType, type, date, createdAt',
  finances:         'id, category, type, date, createdAt',
  staff:            'id, name, role, status, createdAt',
  attendance:       'id, staffId, date, status, createdAt',
  tasks:            'id, staffId, status, dueDate, createdAt',
  notifications:    'id, type, read, createdAt',
  syncQueue:        '++id, table, operation, recordId, data, status, createdAt',
  settings:         'key',
  saccoMembers:     'id, name, phone, nin, category, photo, correctBalance, jan, feb, mar, apr, may, jun, jul, aug, sep, oct, nov, dec, total, shares, admin, savings, mandatory, withdrawable, requested, difference, noOfShares, createdAt',
  saccoShares:      'id, memberId, shareCount, createdAt',
  saccoInvestors:   'id, memberId, category, investorType, investmentPhase, marketingStrategy, moneyMakerAmount, cowsPerYear, createdAt',
  saccoTransactions: 'id, date, type, source, category, amount, createdAt',
  saccoSavings:     'id, memberId, savingAmount, updatedAt',
  saccoYearlySavings: 'id, memberId, year, jan, feb, mar, apr, may, jun, jul, aug, sep, oct, nov, dec, total, createdAt'
})

// ─── Auto-generate UUIDs for all new records ─────────────────────────────────
const SYNC_TABLES = [
  'animals', 'healthRecords', 'breedingRecords', 'milkRecords',
  'feedInventory', 'feedTransactions', 'finances', 'staff',
  'attendance', 'tasks', 'notifications',
  'saccoMembers', 'saccoShares', 'saccoInvestors', 'saccoTransactions', 'saccoSavings', 'saccoYearlySavings'
]

SYNC_TABLES.forEach(table => {
  db[table].hook('creating', function (primKey, obj) {
    if (!obj.id) {
      obj.id = crypto.randomUUID()
    }
  })
})

export default db

