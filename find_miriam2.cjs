const XLSX = require('xlsx')
const path = require('path')

const file = path.join(__dirname, 'SACCO MEMBERSHIP JANTODEC JUNEFYR PHASE 3 (1).xlsx')
const wb = XLSX.readFile(file)

const sheets = ['GENERAL MEMBERSHIP', 'JUNE MEMBERSHIP', 'PIONEER']
for (const sheet of sheets) {
  if (wb.Sheets[sheet]) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { defval: '' })
    const miriamRows = rows.filter(r => {
      const name = String(r['__EMPTY']).toLowerCase()
      return name.includes('miriam')
    })
    if (miriamRows.length > 0) {
      console.log(`\n=== MIRIAM IN ${sheet} ===`)
      console.log(JSON.stringify(miriamRows, null, 2))
    }
  }
}
