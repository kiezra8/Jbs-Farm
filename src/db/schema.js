import Dexie from 'dexie'

export const db = new Dexie('JBSFarmDB')

db.version(1).stores({
  animals:        '++id, tagNumber, name, breed, gender, status, createdAt, updatedAt',
  healthRecords:  '++id, animalId, type, date, createdAt, updatedAt',
  breedingRecords:'++id, animalId, type, date, status, createdAt, updatedAt',
  milkRecords:    '++id, animalId, date, session, createdAt',
  feedInventory:  '++id, feedType, updatedAt',
  feedTransactions:'++id, feedType, type, date, createdAt',
  finances:       '++id, category, type, date, createdAt',
  staff:          '++id, name, role, status, createdAt',
  attendance:     '++id, staffId, date, status, createdAt',
  tasks:          '++id, staffId, status, dueDate, createdAt',
  notifications:  '++id, type, read, createdAt',
  syncQueue:      '++id, table, operation, recordId, data, status, createdAt',
  settings:       'key',
})

export default db
