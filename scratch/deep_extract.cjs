const fs = require('fs');
const path = require('path');

const dirs = [
  'C:\\Users\\israe\\AppData\\Local\\Microsoft\\Edge\\User Data\\Default\\IndexedDB\\https_jbs-farm.pages.dev_0.indexeddb.leveldb',
  'C:\\Users\\israe\\AppData\\Local\\Microsoft\\Edge\\User Data\\Default\\IndexedDB\\http_localhost_5173.indexeddb.leveldb',
  'C:\\Users\\israe\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\IndexedDB\\https_kiezra8.github.io_0.indexeddb.leveldb'
];

const foundAnimals = new Map(); // id -> { id, name, tagNumber, breed, color, status }

dirs.forEach(dir => {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const f of files) {
    if (!f.endsWith('.ldb') && !f.endsWith('.log')) continue;
    const fPath = path.join(dir, f);
    const buf = fs.readFileSync(fPath);
    const str = buf.toString('latin1');

    // Pattern matching for animal objects
    // In Dexie IndexedDB strings often look like:
    // ... "name" ... "breed" ... "tagNumber" ... "id" ...
    // Let's search for "tagNumber" or "breed" and look for UUIDs and names
    const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
    let match;
    while ((match = uuidRegex.exec(str)) !== null) {
      const id = match[0].toLowerCase();
      const pos = match.index;
      // Search window
      const win = str.substring(Math.max(0, pos - 400), Math.min(str.length, pos + 500));
      
      // Look for name
      // Usually "name" <val> or name" <val>
      let name = null;
      let tag = null;
      let breed = null;

      // Extract JSON-like keys
      // name" ... "
      const nameMatch = win.match(/name["\s:]+([A-Za-z0-9'\s\-_]+?)["\r\n\x00]/);
      if (nameMatch && nameMatch[1].length < 30) {
        const n = nameMatch[1].trim();
        if (n && !['string', 'boolean', 'number', 'true', 'false', 'null', 'undefined', 'healthy', 'friesian'].includes(n.toLowerCase())) {
          name = n;
        }
      }

      const tagMatch = win.match(/tagNumber["\s:]+([A-Za-z0-9'\s\-_]+?)["\r\n\x00]/);
      if (tagMatch && tagMatch[1].length < 30) {
        tag = tagMatch[1].trim();
      }

      const breedMatch = win.match(/breed["\s:]+([A-Za-z0-9'\s\-_]+?)["\r\n\x00]/);
      if (breedMatch && breedMatch[1].length < 30) {
        breed = breedMatch[1].trim();
      }

      if (name || tag) {
        if (!foundAnimals.has(id)) {
          foundAnimals.set(id, { id, name, tag, breed, raw: win.replace(/[^\x20-\x7E]/g, ' ') });
        } else {
          const cur = foundAnimals.get(id);
          if (!cur.name && name) cur.name = name;
          if (!cur.tag && tag) cur.tag = tag;
          if (!cur.breed && breed) cur.breed = breed;
        }
      }
    }
  }
});

console.log(`Extracted ${foundAnimals.size} potential animal records!`);
for (const [id, data] of foundAnimals.entries()) {
  console.log(`ID: ${id} => Name: "${data.name}", Tag: "${data.tag}", Breed: "${data.breed}"`);
}
