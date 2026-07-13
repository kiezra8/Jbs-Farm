import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, 'SACCO MEMBERSHIP JANTODEC JUNEFYR PHASE 3 (1).xlsx');
const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(sheet);

const outputPath = path.join(__dirname, 'src', 'db', 'sacco_seed.json');
fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));

console.log("Successfully wrote data to sacco_seed.json");
