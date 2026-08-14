const { createClient } = require('../node_modules/@supabase/supabase-js');

const SUPABASE_URL = 'https://hkdcfkmtdlmslhasrnhv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrZGNma210ZGxtc2xoYXNybmh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMDE2MDEsImV4cCI6MjA5OTY3NzYwMX0.TB27Z8U-xipyyHvOzxfk3ry0wk53mL7lN6j0824JGqQ';

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
  console.log('--- Testing saccoTransactions table schema on Supabase ---');
  const testId = 'test-tx-' + Date.now();
  const { data, error } = await sb.from('saccoTransactions').upsert({
    id: testId,
    date: '2026-08-14',
    type: 'Expense',
    source: 'Petty Cash',
    category: 'Test Category',
    amount: 50000,
    paymentMethod: 'Cash',
    isBanked: false,
    description: 'Test petty cash transaction',
    createdAt: new Date().toISOString()
  }, { onConflict: 'id' });

  if (error) {
    console.error('❌ Error inserting saccoTransactions:', error);
  } else {
    console.log('✅ Successfully inserted saccoTransactions test record!');
    await sb.from('saccoTransactions').delete().eq('id', testId);
  }
}

main().catch(console.error);
