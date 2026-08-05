// Script to create finances table in Supabase and push all local data
// Run from project root: node scratch/setup_finances_supabase.cjs

const { createClient } = require('../node_modules/@supabase/supabase-js');

const SUPABASE_URL = 'https://hkdcfkmtdlmslhasrnhv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrZGNma210ZGxtc2xoYXNybmh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMDE2MDEsImV4cCI6MjA5OTY3NzYwMX0.TB27Z8U-xipyyHvOzxfk3ry0wk53mL7lN6j0824JGqQ';

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
  console.log('--- Supabase Finances Diagnostic ---\n');

  // Try a test insert to check if table exists with correct structure
  const testId = 'test-check-' + Date.now();
  const { error: insertError } = await sb.from('finances').upsert({
    id: testId,
    date: '2026-01-01',
    type: 'Expense',
    source: 'Test',
    category: 'Test',
    amount: 0,
    description: 'diagnostic test',
    reference: '',
    createdAt: new Date().toISOString()
  }, { onConflict: 'id' });

  if (insertError) {
    console.error('❌ Cannot write to finances table:', insertError.message);
    console.log('\nThe "finances" table does NOT exist in Supabase.');
    console.log('\nYou need to create it manually in the Supabase dashboard.');
    console.log('\nGo to: https://supabase.com/dashboard/project/hkdcfkmtdlmslhasrnhv/editor');
    console.log('\nRun this SQL:\n');
    console.log(`CREATE TABLE IF NOT EXISTS public.finances (
  id TEXT PRIMARY KEY,
  date TEXT,
  type TEXT,
  source TEXT,
  category TEXT,
  amount NUMERIC,
  description TEXT,
  reference TEXT,
  "createdAt" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ
);

-- Enable Row Level Security (allow all for now since app uses anon key)
ALTER TABLE public.finances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for anon" ON public.finances
  FOR ALL USING (true) WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.finances;`);
    return;
  }

  console.log('✅ finances table EXISTS and is writable!');

  // Clean up test record
  await sb.from('finances').delete().eq('id', testId);

  // Count records
  const { data: allData, error: fetchError } = await sb.from('finances').select('date');
  if (fetchError) {
    console.error('Error fetching:', fetchError.message);
    return;
  }

  console.log(`Total records in Supabase: ${allData.length}`);

  const byMonth = {};
  allData.forEach(r => {
    const p = r.date ? r.date.slice(0, 7) : 'unknown';
    byMonth[p] = (byMonth[p] || 0) + 1;
  });

  const months = Object.keys(byMonth).sort((a, b) => b.localeCompare(a));
  if (months.length === 0) {
    console.log('No records found — table is empty.');
  } else {
    console.log('\nRecords by month:');
    months.forEach(m => console.log(`  ${m}: ${byMonth[m]} records`));
  }
}

main().catch(console.error);
