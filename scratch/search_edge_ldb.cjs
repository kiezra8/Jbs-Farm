const fs = require('fs');
const path = require('path');

const edgeDir = 'C:\\Users\\israe\\AppData\\Local\\Microsoft\\Edge\\User Data\\Default\\IndexedDB';
const targets = [
  'https_jbs-farm.pages.dev_0.indexeddb.leveldb',
  'http_localhost_5173.indexeddb.leveldb',
  'http_192.168.1.5_5174.indexeddb.leveldb'
];

const targetUUIDs = [
  '8dd35b73-bdb1-44a0-9b2b-c2e20f7939eb',
  'e5f5c527-e239-4e08-bf58-ce4c6d8c2a9a',
  '562ec4bf-7e2d-4097-81c6-1308d482da7a',
  'eea3f603-fbd4-4f6a-ab22-b5eec1fe4727',
  '63152c99-0f06-487f-8129-7d14c2ddb262',
  '98763729-c2bc-4d15-83bd-abb20e54480c',
  'c886d9da-0a13-4f9d-a748-9a20b3c2f10d',
  'dd732116-d45e-4f6d-b79c-7a998eb4b2ed',
  '64156c51-2558-4c4b-9125-a2eedab6d815',
  '284857c2-ffa7-4434-8268-76cd1c7fd354',
  '5ea7620b-ae6f-4f0c-85e5-f1ee2cba7dca',
  '35f96450-e4b4-4caf-b409-d5915b417796',
  '1952681a-948f-40d7-be45-9a785ee85bdf',
  '5a586c21-44ae-4774-86f8-76ca201521e4',
  'c92431c6-61eb-453e-aefb-0247592aaa51',
  '390eb867-dc40-4123-9fdf-12c188f83354',
  '05d0911b-e583-4f80-b2e4-51a01cae6144',
  '8dfb74c1-f493-4a86-9116-ce94122ba966'
];

for (const t of targets) {
  const full = path.join(edgeDir, t);
  if (!fs.existsSync(full)) continue;
  console.log(`\n================ Checking ${t} ================`);
  const files = fs.readdirSync(full);
  for (const f of files) {
    if (!f.endsWith('.ldb') && !f.endsWith('.log')) continue;
    const fPath = path.join(full, f);
    try {
      const buf = fs.readFileSync(fPath);
      const str = buf.toString('latin1');
      console.log(`Checking ${f} (${buf.length} bytes)...`);

      for (const uuid of targetUUIDs) {
        let pos = 0;
        while ((pos = str.indexOf(uuid, pos)) !== -1) {
          const snip = str.substring(Math.max(0, pos - 200), Math.min(str.length, pos + 300)).replace(/[^\x20-\x7E]/g, ' ');
          console.log(`>>> FOUND UUID ${uuid} in ${f}:`);
          console.log(snip);
          pos += uuid.length;
        }
      }
    } catch (e) {
      console.log(`Could not read ${f}:`, e.message);
    }
  }
}
