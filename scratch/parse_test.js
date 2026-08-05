const XLSX = require('xlsx');
const { format } = require('date-fns');

const file = 'PETTY CASH UTILISATION 1.xlsx';
const wb = XLSX.readFile(file);

const parseExcelDate = (val) => {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') {
    // Excel base date is Dec 30, 1899 (due to leap year bug in 1900)
    // Using UTC date to avoid timezone shift issues
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    // To prevent local timezone shifting the date, we can read UTC components
    const utcYear = date.getUTCFullYear();
    const utcMonth = date.getUTCMonth();
    const utcDay = date.getUTCDate();
    try { return format(new Date(utcYear, utcMonth, utcDay), 'yyyy-MM-dd') } catch (_) { return null }
  }
  try {
    const str = String(val).trim();
    const match = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (match) {
      let d = parseInt(match[1], 10);
      let m = parseInt(match[2], 10) - 1;
      let y = parseInt(match[3], 10);
      if (y < 100) y += 2000;
      return format(new Date(y, m, d), 'yyyy-MM-dd');
    }
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) return format(parsed, 'yyyy-MM-dd');
  } catch (_) {}
  return null;
};

wb.SheetNames.forEach(sheetName => {
  const ws = wb.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json(ws, { defval: '', header: 1 });
  if (rawRows.length === 0) return;

  let headerIndex = -1;
  for (let idx = 0; idx < Math.min(10, rawRows.length); idx++) {
    const r = rawRows[idx];
    if (r && (r.includes('Particulars') || r.includes('Exepense Particulars') || r.includes('Recipeint') || r.includes('Client Name'))) {
      headerIndex = idx;
      break;
    }
  }

  if (headerIndex !== -1) {
    console.log(`\n=== Sheet: ${sheetName} ===`);
    let lastReceiptDate = 'no-date';
    let lastPaymentDate = 'no-date';

    for (let i = headerIndex + 1; i < Math.min(headerIndex + 15, rawRows.length); i++) {
      const row = rawRows[i];
      if (!row || row.length === 0) continue;

      const rDateVal = row[0];
      const rDateParsed = parseExcelDate(rDateVal);
      if (rDateParsed) lastReceiptDate = rDateParsed;

      const pDateVal = row[8];
      const pDateParsed = parseExcelDate(pDateVal);
      if (pDateParsed) lastPaymentDate = pDateParsed;

      console.log(`Row ${i}: rDateVal=${rDateVal} -> rParsed=${rDateParsed} (lastReceipt=${lastReceiptDate}) | pDateVal=${pDateVal} -> pParsed=${pDateParsed} (lastPayment=${lastPaymentDate})`);
    }
  }
});
