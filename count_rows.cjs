const XLSX = require('xlsx')
const path = require('path')

const file = path.join(__dirname, 'SACCO MEMBERSHIP JANTODEC JUNEFYR PHASE 3 (1).xlsx')
const wb = XLSX.readFile(file)

let total = 0
for (const sheet of wb.SheetNames) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { defval: '' })
  console.log(`${sheet}: ${rows.length}`)
  total += rows.length
}
console.log('Total:', total)
