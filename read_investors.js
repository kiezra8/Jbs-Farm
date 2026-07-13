import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, 'INVESTMENT PHASE.xlsx');
const workbook = XLSX.readFile(filePath);
const ws = workbook.Sheets['Sheet1'];
const rawData = XLSX.utils.sheet_to_json(ws, { defval: '' });

// Skip the header row (row 0) and empty rows
const cleaned = rawData
  .slice(1) // skip header row
  .filter(row => {
    const name = String(row['__EMPTY'] || '').trim();
    return name && name !== 'NAMES' && typeof row['JBS INVESTMENT CLUB'] === 'number';
  })
  .map(row => {
    // Clean the name - remove emojis, extra spaces, and amount suffix like "- 8m✅"
    let rawName = String(row['__EMPTY'] || '').trim();
    // Remove trailing " - 8m✅" or " - 16m✅" patterns
    rawName = rawName.replace(/\s*-\s*\d+m[✅]?/g, '').trim();
    // Remove leading/trailing invisible chars
    rawName = rawName.replace(/[\u200B-\u200D\uFEFF\u2060]/g, '').trim();

    const program = Number(row['__EMPTY_1']) || 0;
    const paid = Number(row['__EMPTY_2']) || 0;
    const balance = Number(row['__EMPTY_3']) || 0;
    const status = String(row['__EMPTY_4'] || '').trim().toUpperCase();
    const number = Number(row['JBS INVESTMENT CLUB']);

    return {
      number,
      name: rawName,
      program,       // Total investment program amount
      paid,          // Amount paid so far
      balance,       // Remaining balance
      status,        // CLEARED or NOT CLEARED
      cleared: status === 'CLEARED' || balance === 0,
      investorType: 'Money Maker',
      investmentPhase: 'Phase 3',
      marketingStrategy: false,
      investmentAmount: paid, // what they have actually paid
    };
  });

const outputPath = path.join(__dirname, 'src', 'db', 'investors_seed.json');
fs.writeFileSync(outputPath, JSON.stringify(cleaned, null, 2));

console.log(`Saved ${cleaned.length} investor records to investors_seed.json`);
console.log('\nSample records:');
cleaned.slice(0, 5).forEach(r => console.log(JSON.stringify(r)));
console.log('\nNot Cleared:');
cleaned.filter(r => !r.cleared).slice(0, 5).forEach(r => console.log(JSON.stringify(r)));
