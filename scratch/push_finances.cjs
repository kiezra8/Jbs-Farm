/**
 * push_finances_to_supabase.cjs
 * 
 * Run this AFTER creating the finances table in Supabase.
 * This reads local IndexedDB and pushes all finance records to Supabase.
 * 
 * NOTE: This script cannot read IndexedDB directly (it's browser-only).
 * Instead, open the app in a browser and run this in the browser console:
 * 
 *   const { forceUploadSaccoToSupabase } = await import('/src/services/supabaseSyncEngine.js');
 *   const count = await forceUploadSaccoToSupabase();
 *   console.log('Pushed', count, 'records');
 * 
 * OR add this button to Settings page temporarily to trigger the push.
 */

const { createClient } = require('../node_modules/@supabase/supabase-js');

const SUPABASE_URL = 'https://hkdcfkmtdlmslhasrnhv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrZGNma210ZGxtc2xoYXNybmh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMDE2MDEsImV4cCI6MjA5OTY3NzYwMX0.TB27Z8U-xipyyHvOzxfk3ry0wk53mL7lN6j0824JGqQ';

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkTable() {
  const { data, error } = await sb.from('finances').select('id').limit(1);
  if (error) {
    console.log('❌ finances table still missing:', error.message);
    console.log('\nPlease create the table first by going to:');
    console.log('https://supabase.com/dashboard/project/hkdcfkmtdlmslhasrnhv/sql/new');
    return false;
  }
  console.log('✅ finances table EXISTS!');
  const { data: all } = await sb.from('finances').select('date');
  const byMonth = {};
  (all || []).forEach(r => {
    const p = (r.date || 'unknown').slice(0, 7);
    byMonth[p] = (byMonth[p] || 0) + 1;
  });
  console.log(`Total in Supabase: ${(all || []).length}`);
  Object.keys(byMonth).sort((a, b) => b.localeCompare(a)).forEach(m => console.log(`  ${m}: ${byMonth[m]}`));
  return true;
}

checkTable().catch(console.error);
