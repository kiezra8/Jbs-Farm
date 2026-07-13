const XLSX = require('xlsx')
const path = require('path')

const file = path.join(__dirname, 'SACCO MEMBERSHIP JANTODEC JUNEFYR PHASE 3 (1).xlsx')
const wb = XLSX.readFile(file)

for (const sheet of wb.SheetNames) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { defval: '' })
  const miriamRows = rows.filter(r => {
    return Object.values(r).some(val => String(val).toLowerCase().includes('miriam'))
  })
  if (miriamRows.length > 0) {
    console.log(`\n=== MIRIAM IN ${sheet} ===`)
    console.log(JSON.stringify(miriamRows, null, 2))
  }
}
