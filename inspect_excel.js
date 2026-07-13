import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, 'INVESTMENT PHASE.xlsx');
const workbook = XLSX.readFile(filePath);

console.log('=== SHEET NAMES ===');
console.log(workbook.SheetNames);

workbook.SheetNames.forEach(name => {
  console.log(`\n=== SHEET: ${name} ===`);
  const ws = workbook.Sheets[name];
  const data = XLSX.utils.sheet_to_json(ws, { defval: '' });
  console.log(`Rows: ${data.length}`);
  if (data.length > 0) {
    console.log('Column keys:', Object.keys(data[0]));
    console.log('\nFirst 5 rows:');
    data.slice(0, 5).forEach((row, i) => console.log(`  Row ${i}:`, JSON.stringify(row)));
  }

  // Save to JSON
  const outputPath = path.join(__dirname, `src/db/investors_seed_${name.replace(/\s+/g,'_')}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
  console.log(`Saved to ${outputPath}`);
});
