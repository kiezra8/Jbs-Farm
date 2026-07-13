const XLSX = require('xlsx')
const path = require('path')

const file = path.join(__dirname, 'INVESTMENT PHASE.xlsx')
const wb = XLSX.readFile(file)

console.log('\n=== SHEET NAMES ===')
console.log(wb.SheetNames)

for (const sheetName of wb.SheetNames) {
  const ws = wb.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
  
  if (rows.length > 0) {
    console.log(`\n=== HEADERS for sheet "${sheetName}" ===`)
    console.log(Object.keys(rows[0]))
    console.log('\n=== FIRST DATA ROW ===')
    console.log(JSON.stringify(rows[0], null, 2))
  }
}
