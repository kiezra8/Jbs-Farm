import { db } from '../db/schema'
import { format, subDays } from 'date-fns'

// ─── Seed Animals ───────────────────────────────────────────────
const breeds = ['Friesian', 'Ayrshire', 'Guernsey', 'Jersey', 'Sahiwal', 'Boran']
const statuses = ['Healthy', 'Healthy', 'Healthy', 'Pregnant', 'Sick', 'Calf']
const femaleNames = ['Daisy','Bella','Rosie','Molly','Luna','Stella','Coco','Lily','Nala','Zara','Mia','Ruby','Flora','Ivy','Grace','Nora','Pearl','Amber','Cleo','Dora']
const maleNames = ['Bruno','Max','Duke','Titan','Rex','Thor','Goliath','King','Samson','Brutus']

function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }
function rndFloat(min, max) { return parseFloat((Math.random() * (max - min) + min).toFixed(1)) }
function daysAgo(d) { return format(subDays(new Date(), d), 'yyyy-MM-dd') }

export async function seedDatabase() {
  // Check if already seeded
  const count = await db.animals.count()
  if (count > 0) return

  console.log('🌱 Seeding JBS Farm database...')

  // ── Animals ──
  const animalIds = []
  for (let i = 1; i <= 42; i++) {
    const isMale = i > 36
    const gender = isMale ? 'Male' : 'Female'
    const status = isMale ? 'Healthy' : statuses[rnd(0, statuses.length - 1)]
    const name = isMale ? maleNames[i - 37] || `Bull-${i}` : femaleNames[i - 1] || `Cow-${i}`
    const breed = breeds[rnd(0, breeds.length - 1)]
    const id = await db.animals.add({
      tagNumber: `JBS-${String(i).padStart(3, '0')}`,
      name,
      breed,
      gender,
      status,
      weight: rnd(280, 620),
      age: rnd(6, 96),
      dob: daysAgo(rnd(180, 2880)),
      purchaseDate: daysAgo(rnd(30, 730)),
      purchasePrice: rnd(45000, 180000),
      color: ['Black & White', 'Brown', 'Red & White', 'Cream', 'Dun'][rnd(0, 4)],
      notes: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    animalIds.push(id)
  }

  // ── Milk Records (90 days) ──
  const cowIds = animalIds.slice(0, 30) // first 30 are milking cows
  for (let d = 89; d >= 0; d--) {
    const date = format(subDays(new Date(), d), 'yyyy-MM-dd')
    for (const animalId of cowIds.slice(0, rnd(18, 28))) {
      // Morning
      await db.milkRecords.add({ animalId, date, session: 'Morning', amount: rndFloat(4, 18), createdAt: new Date().toISOString() })
      // Evening
      await db.milkRecords.add({ animalId, date, session: 'Evening', amount: rndFloat(3, 14), createdAt: new Date().toISOString() })
    }
  }

  // ── Health Records ──
  const healthTypes = ['Vaccination', 'Treatment', 'Deworming', 'Vet Visit', 'Deworming', 'Vaccination']
  const diseases = ['FMD', 'Mastitis', 'Bloat', 'Lumpy Skin', 'ECF', 'Pneumonia']
  const vaccines = ['FMD Vaccine', 'LSD Vaccine', 'Brucellosis', 'Anthrax', 'Blackleg']
  for (let i = 0; i < 60; i++) {
    const type = healthTypes[rnd(0, healthTypes.length - 1)]
    await db.healthRecords.add({
      animalId: animalIds[rnd(0, animalIds.length - 1)],
      type,
      date: daysAgo(rnd(0, 180)),
      diagnosis: type === 'Treatment' ? diseases[rnd(0, diseases.length - 1)] : null,
      treatment: type === 'Treatment' ? 'Antibiotics + supportive care' : null,
      vaccine: type === 'Vaccination' ? vaccines[rnd(0, vaccines.length - 1)] : null,
      vet: 'Dr. Kamau',
      cost: rnd(500, 8000),
      notes: '',
      nextDue: type === 'Vaccination' ? format(subDays(new Date(), -rnd(30, 180)), 'yyyy-MM-dd') : null,
      status: 'Completed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  }

  // ── Breeding Records ──
  const breedingStatuses = ['Confirmed Pregnant', 'Confirmed Pregnant', 'Calved', 'Open', 'Pending Check']
  for (let i = 0; i < 25; i++) {
    const status = breedingStatuses[rnd(0, breedingStatuses.length - 1)]
    const date = daysAgo(rnd(10, 240))
    await db.breedingRecords.add({
      animalId: animalIds[rnd(0, 29)],
      type: rnd(0, 1) ? 'Artificial' : 'Natural',
      date,
      bull: 'Titan (JBS-037)',
      status,
      expectedCalving: status === 'Confirmed Pregnant' ? format(subDays(new Date(), -rnd(10, 120)), 'yyyy-MM-dd') : null,
      calvingDate: status === 'Calved' ? daysAgo(rnd(5, 60)) : null,
      calfGender: status === 'Calved' ? (rnd(0, 1) ? 'Male' : 'Female') : null,
      notes: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  }

  // ── Feed Inventory ──
  const feedTypes = [
    { feedType: 'Dairy Meal', unit: 'kg', currentStock: rnd(800, 2000), minStock: 500, unitCost: 45 },
    { feedType: 'Hay', unit: 'bales', currentStock: rnd(80, 200), minStock: 50, unitCost: 120 },
    { feedType: 'Silage', unit: 'kg', currentStock: rnd(1500, 4000), minStock: 1000, unitCost: 8 },
    { feedType: 'Pasture', unit: 'acres', currentStock: rnd(20, 80), minStock: 30, unitCost: 200 },
    { feedType: 'Mineral Lick', unit: 'kg', currentStock: rnd(20, 80), minStock: 30, unitCost: 200 },
    { feedType: 'Maize Germ', unit: 'kg', currentStock: rnd(200, 600), minStock: 200, unitCost: 25 },
    { feedType: 'Cottonseed Cake', unit: 'kg', currentStock: rnd(100, 400), minStock: 150, unitCost: 65 },
  ]
  for (const feed of feedTypes) {
    await db.feedInventory.add({ ...feed, updatedAt: new Date().toISOString() })
  }

  // ── Feed Transactions ──
  for (let i = 0; i < 30; i++) {
    const feed = feedTypes[rnd(0, feedTypes.length - 1)]
    const type = rnd(0, 2) === 0 ? 'Purchase' : 'Consumption'
    const qty = rnd(50, 500)
    await db.feedTransactions.add({
      feedType: feed.feedType,
      type,
      quantity: qty,
      unit: feed.unit,
      totalCost: type === 'Purchase' ? qty * feed.unitCost : 0,
      date: daysAgo(rnd(0, 90)),
      supplier: type === 'Purchase' ? ['Unga Feeds', 'Simlaw Seeds', 'Royal Feeds'][rnd(0, 2)] : null,
      notes: '',
      createdAt: new Date().toISOString(),
    })
  }

  // ── Finances ──
  const incomeCategories = ['Milk Sales', 'Animal Sales', 'Breeding Fees', 'Government Subsidy']
  const expenseCategories = ['Feed', 'Veterinary', 'Salaries', 'Equipment', 'Utilities', 'Transport', 'Maintenance']
  for (let i = 0; i < 80; i++) {
    const isIncome = rnd(0, 2) === 0
    const category = isIncome ? incomeCategories[rnd(0, incomeCategories.length - 1)] : expenseCategories[rnd(0, expenseCategories.length - 1)]
    await db.finances.add({
      type: isIncome ? 'Income' : 'Expense',
      category,
      amount: rnd(isIncome ? 5000 : 500, isIncome ? 80000 : 35000),
      description: `${category} - ${daysAgo(rnd(0, 180))}`,
      date: daysAgo(rnd(0, 180)),
      reference: `REF-${rnd(1000, 9999)}`,
      createdAt: new Date().toISOString(),
    })
  }

  // ── Staff ──
  const staffData = [
    { name: 'John Kamau', role: 'Farm Manager', phone: '0712345678', salary: 45000, status: 'Active', joinDate: daysAgo(730) },
    { name: 'Mary Wanjiku', role: 'Milking Attendant', phone: '0723456789', salary: 22000, status: 'Active', joinDate: daysAgo(540) },
    { name: 'Peter Otieno', role: 'Milking Attendant', phone: '0734567890', salary: 22000, status: 'Active', joinDate: daysAgo(365) },
    { name: 'Grace Achieng', role: 'Feed Manager', phone: '0745678901', salary: 28000, status: 'Active', joinDate: daysAgo(480) },
    { name: 'David Mwangi', role: 'Security Guard', phone: '0756789012', salary: 18000, status: 'Active', joinDate: daysAgo(600) },
    { name: 'Alice Njeri', role: 'Record Keeper', phone: '0767890123', salary: 25000, status: 'Active', joinDate: daysAgo(290) },
  ]
  const staffIds = []
  for (const s of staffData) {
    const id = await db.staff.add({ ...s, createdAt: new Date().toISOString() })
    staffIds.push(id)
  }

  // ── Attendance (30 days) ──
  for (let d = 29; d >= 0; d--) {
    const date = format(subDays(new Date(), d), 'yyyy-MM-dd')
    for (const staffId of staffIds) {
      await db.attendance.add({
        staffId,
        date,
        status: rnd(0, 9) > 1 ? 'Present' : 'Absent',
        timeIn: '06:30',
        timeOut: '18:00',
        createdAt: new Date().toISOString(),
      })
    }
  }

  // ── Tasks ──
  const taskList = [
    'Morning milking session', 'Evening milking session', 'Feed cattle - Dairy Meal',
    'Clean water troughs', 'Check fence perimeter', 'Vaccination follow-up - JBS-012',
    'Pregnancy check - JBS-007', 'Record feed consumption', 'Clean milking parlour',
    'Prepare vet report', 'Service milking machine', 'Order feed from Unga Feeds',
  ]
  for (let i = 0; i < taskList.length; i++) {
    await db.tasks.add({
      title: taskList[i],
      staffId: staffIds[rnd(0, staffIds.length - 1)],
      status: rnd(0, 1) ? 'Completed' : 'Pending',
      priority: ['High', 'Medium', 'Low'][rnd(0, 2)],
      dueDate: format(subDays(new Date(), -rnd(0, 7)), 'yyyy-MM-dd'),
      createdAt: new Date().toISOString(),
    })
  }

  // ── Notifications ──
  const notifs = [
    { type: 'health', title: 'Vaccination Due', message: 'JBS-008 (Daisy) FMD vaccination due in 3 days', icon: '💉' },
    { type: 'breeding', title: 'Calving Expected', message: 'JBS-014 (Stella) expected to calve within 7 days', icon: '🐄' },
    { type: 'feed', title: 'Low Stock Alert', message: 'Mineral Lick stock below minimum threshold', icon: '⚠️' },
    { type: 'health', title: 'Sick Animal Alert', message: 'JBS-023 (Flora) showing signs of mastitis', icon: '🏥' },
    { type: 'system', title: 'Sync Complete', message: 'All data synced to cloud successfully', icon: '☁️' },
    { type: 'milk', title: 'Production Drop', message: 'Milk production dropped 8% compared to yesterday', icon: '📉' },
    { type: 'finance', title: 'Monthly Report Ready', message: 'May 2026 financial summary is ready', icon: '📊' },
  ]
  for (const n of notifs) {
    await db.notifications.add({ ...n, read: rnd(0, 1) === 0, createdAt: subDays(new Date(), rnd(0, 7)).toISOString() })
  }

  console.log('✅ JBS Farm database seeded successfully!')
}
