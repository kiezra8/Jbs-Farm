const XLSX = require('xlsx')
const path = require('path')

const file = path.join(__dirname, 'INVESTMENT PHASE.xlsx')
const wb = XLSX.readFile(file)
const ws = wb.Sheets['Sheet1']
const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })

console.log('Total rows:', rows.length)
console.log('Sample rows:', JSON.stringify(rows.slice(0, 5), null, 2))
