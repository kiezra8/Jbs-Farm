const { createClient } = require('../node_modules/@supabase/supabase-js');

const SUPABASE_URL = 'https://hkdcfkmtdlmslhasrnhv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrZGNma210ZGxtc2xoYXNybmh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMDE2MDEsImV4cCI6MjA5OTY3NzYwMX0.TB27Z8U-xipyyHvOzxfk3ry0wk53mL7lN6j0824JGqQ';

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const TABLES = [
  'animals',
  'healthRecords',
  'breedingRecords',
  'milkRecords',
  'feedInventory',
  'feedTransactions',
  'finances',
  'staff',
  'attendance',
  'tasks',
  'notifications',
  'saccoMembers',
  'saccoShares',
  'saccoInvestors',
  'saccoTransactions',
  'saccoSavings',
  'saccoYearlySavings'
];

async function main() {
  console.log('--- Checking Supabase Tables ---');
  for (const table of TABLES) {
    const { data, error, count } = await sb.from(table).select('*', { count: 'exact', head: true });
    if (error) {
      console.log(`❌ Table [${table}]: ERROR (${error.message})`);
    } else {
      console.log(`✅ Table [${table}]: EXISTS (${count} records)`);
    }
  }
}

main().catch(console.error);
