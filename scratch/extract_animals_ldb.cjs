const fs = require('fs');
const path = require('path');

const dir = 'C:\\Users\\israe\\AppData\\Local\\Microsoft\\Edge\\User Data\\Default\\IndexedDB\\https_jbs-farm.pages.dev_0.indexeddb.leveldb';
const files = fs.readdirSync(dir);

const targetUUIDs = new Set([
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
  '8dfb74c1-f493-4a86-9116-ce94122ba966',
  'a67bf2fe-bac9-40b8-8e35-ca3216e50305',
  '9ac67bbf-b0f8-41de-8dec-3474513c097f',
  '40b1f92a-9074-4600-8831-6610e4727d80',
  '58d18644-4c06-401d-abdc-4e36d96ca100'
]);

const results = new Map();

for (const f of files) {
  if (!f.endsWith('.ldb') && !f.endsWith('.log')) continue;
  const fPath = path.join(dir, f);
  const buf = fs.readFileSync(fPath);
  const str = buf.toString('latin1');

  // Search for each UUID
  for (const uuid of targetUUIDs) {
    let pos = 0;
    while ((pos = str.indexOf(uuid, pos)) !== -1) {
      // Look forward and backward up to 500 chars for words like "name", "tagNumber", "tag"
      const snippet = str.substring(Math.max(0, pos - 300), Math.min(str.length, pos + 500));
      if (snippet.includes('breed') || snippet.includes('tagNumber') || snippet.includes('gender') || snippet.includes('status')) {
        results.set(uuid, snippet.replace(/[^\x20-\x7E]/g, ' '));
      }
      pos += uuid.length;
    }
  }

  // Also general scan for any animal entries
  const breedIdx = 0;
  let p = 0;
  while ((p = str.indexOf('breed', p)) !== -1) {
    const snip = str.substring(Math.max(0, p - 200), Math.min(str.length, p + 300)).replace(/[^\x20-\x7E]/g, ' ');
    // Check if any target UUID is in this snippet
    for (const uuid of targetUUIDs) {
      if (snip.includes(uuid)) {
        console.log(`MATCH FOR ${uuid} near 'breed':\n${snip}\n`);
        results.set(uuid, snip);
      }
    }
    p += 5;
  }
}

console.log(`Total UUIDs matched with animal metadata: ${results.size}`);
for (const [id, snip] of results.entries()) {
  console.log(`--- ${id} ---`);
  console.log(snip);
}
