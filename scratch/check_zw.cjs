const { createClient } = require('../node_modules/@supabase/supabase-js');
const SUPABASE_URL = 'https://hkdcfkmtdlmslhasrnhv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrZGNma210ZGxtc2xoYXNybmh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMDE2MDEsImV4cCI6MjA5OTY3NzYwMX0.TB27Z8U-xipyyHvOzxfk3ry0wk53mL7lN6j0824JGqQ';

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
  const { data: members } = await sb.from('saccoMembers').select('id, name');
  const zw = members.filter(m => /[\u200B-\u200D\uFEFF\u2060]/.test(m.name));
  console.log('Members with zero-width characters in name:', zw.length);
  zw.slice(0, 10).forEach(m => console.log('  ', m.id, '->', JSON.stringify(m.name)));
}
main().catch(console.error);
