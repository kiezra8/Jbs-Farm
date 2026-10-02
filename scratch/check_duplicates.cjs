const { createClient } = require('../node_modules/@supabase/supabase-js');
const SUPABASE_URL = 'https://hkdcfkmtdlmslhasrnhv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrZGNma210ZGxtc2xoYXNybmh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMDE2MDEsImV4cCI6MjA5OTY3NzYwMX0.TB27Z8U-xipyyHvOzxfk3ry0wk53mL7lN6j0824JGqQ';

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const cleanName = (name) => {
  if (!name) return '';
  let n = name.replace(/✅/g, '').replace(/bal\.?\s*\d+[\d\.,]*\s*[m]?(illion)?/gi, '').replace(/\b\d+[\d\.,]*\s*m\b/gi, '').replace(/\bbal\b.*/gi, '').replace(/[\-\–\—]/g, ' ').replace(/^(mr\.|mrs\.|ms\.|dr\.|mr|mrs|ms|dr)\b/gi, '').replace(/[\.\,\(\)\&\:\/\;\*\?\"\']/g, ' ').replace(/\b(and|with|or)\b/gi, ' ').replace(/\s+/g, ' ');
  return n.trim();
};
const getSortedWords = (name) => cleanName(name).toLowerCase().split(' ').filter(w => w.length > 1).sort().join(' ');

async function main() {
  const { data: members, error } = await sb.from('saccoMembers').select('*');
  if (error) {
    console.error('Error fetching members:', error);
    return;
  }
  const counts = {};
  for (const m of members) {
    const key = getSortedWords(m.name);
    if (!key) continue;
    if (!counts[key]) counts[key] = [];
    counts[key].push(m);
  }
  const duplicates = Object.entries(counts).filter(([k, list]) => list.length > 1);
  console.log('Total members in DB:', members.length);
  console.log('Total unique keys:', Object.keys(counts).length);
  console.log('Duplicate names groups count:', duplicates.length);
  for (const [key, list] of duplicates.slice(0, 15)) {
    console.log(`\n--- Duplicate group: "${key}" (${list.length} records) ---`);
    list.forEach(m => console.log('   ID:', m.id, 'Name:', m.name, 'Cat:', m.category, 'Total:', m.total));
  }
}
main().catch(console.error);
