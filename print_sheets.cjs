const XLSX = require('xlsx')
const path = require('path')

const file = path.join(__dirname, 'SACCO MEMBERSHIP JANTODEC JUNEFYR PHASE 3 (1).xlsx')
const wb = XLSX.readFile(file)

console.log(wb.SheetNames)
