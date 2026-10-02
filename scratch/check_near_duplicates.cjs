const { createClient } = require('../node_modules/@supabase/supabase-js');
const SUPABASE_URL = 'https://hkdcfkmtdlmslhasrnhv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrZGNma210ZGxtc2xoYXNybmh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMDE2MDEsImV4cCI6MjA5OTY3NzYwMX0.TB27Z8U-xipyyHvOzxfk3ry0wk53mL7lN6j0824JGqQ';

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const cleanNameStrict = (name) => {
  if (!name) return '';
  let n = name;
  // strip zero-width spaces and invisible characters
  n = n.replace(/[\u200B-\u200D\uFEFF\u2060]/g, '');
  n = n.replace(/✅/g, '');
  n = n.replace(/\b\d+\b/g, ''); // strip standalone numbers like "5" in "AJORE EVELYN 5"
  n = n.replace(/bal\.?\s*\d+[\d\.,]*\s*[m]?(illion)?/gi, '');
  n = n.replace(/\b\d+[\d\.,]*\s*m\b/gi, '');
  n = n.replace(/\bbal\b.*/gi, '');
  n = n.replace(/[\-\–\—]/g, ' ');
  n = n.replace(/^(mr\.|mrs\.|ms\.|dr\.|mr|mrs|ms|dr)\b/gi, '');
  n = n.replace(/[\.\,\(\)\&\:\/\;\*\?\"\']/g, ' ');
  n = n.replace(/\b(and|with|or)\b/gi, ' ');
  n = n.replace(/\s+/g, ' ');
  return n.trim().toLowerCase();
};

const getWords = (name) => cleanNameStrict(name).split(' ').filter(w => w.length > 1).sort().join(' ');

async function main() {
  const { data: members } = await sb.from('saccoMembers').select('id, name, category, total');
  const map = new Map();
  for (const m of members) {
    const key = getWords(m.name);
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(m);
  }

  const dupes = [];
  for (const [key, list] of map.entries()) {
    if (list.length > 1) {
      dupes.push({ key, list });
    }
  }

  console.log('Near duplicates found:', dupes.length);
  for (const d of dupes) {
    console.log(`\nKey: "${d.key}" (${d.list.length} records)`);
    d.list.forEach(m => console.log('  ', m.id, '->', JSON.stringify(m.name), 'Cat:', m.category, 'Total:', m.total));
  }
}
main().catch(console.error);
