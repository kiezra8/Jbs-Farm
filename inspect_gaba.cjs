const XLSX = require('xlsx')
const path = require('path')

const file = path.join(__dirname, 'SACCO MEMBERSHIP JANTODEC JUNEFYR PHASE 3 (1).xlsx')
const wb = XLSX.readFile(file)

// Show all data from PIONEER sheet
const ws = wb.Sheets['PIONEER']
const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
console.log('\n=== PIONEER SHEET ALL ROWS ===')
rows.slice(0, 10).forEach((r, i) => {
  console.log(`\nRow ${i}:`, JSON.stringify(r, null, 2))
})

// Show Gaba Denis in GENERAL MEMBERSHIP
const ws2 = wb.Sheets['GENERAL MEMBERSHIP']
const rows2 = XLSX.utils.sheet_to_json(ws2, { defval: '' })
const gabaGen = rows2.find(r => {
  const n = (r["JB'S TEAM 100 MODERN FARMERS SACCO FULLY PAID  SACCO MEMBERS."] || '').toString().toLowerCase()
  return n.includes('gaba')
})
if (gabaGen) {
  console.log('\n=== GABA DENIS in GENERAL MEMBERSHIP ===')
  console.log(JSON.stringify(gabaGen, null, 2))
}

// PHASE 3 first 5 data rows
const ws3 = wb.Sheets['PHASE 3']
const rows3 = XLSX.utils.sheet_to_json(ws3, { defval: '' })
console.log('\n=== PHASE 3 first 5 rows ===')
rows3.slice(0, 5).forEach((r, i) => {
  console.log(`Row ${i}:`, JSON.stringify(r))
})
