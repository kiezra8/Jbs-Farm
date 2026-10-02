const { createClient } = require('../node_modules/@supabase/supabase-js');
const SUPABASE_URL = 'https://hkdcfkmtdlmslhasrnhv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrZGNma210ZGxtc2xoYXNybmh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMDE2MDEsImV4cCI6MjA5OTY3NzYwMX0.TB27Z8U-xipyyHvOzxfk3ry0wk53mL7lN6j0824JGqQ';

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
  const { data: members } = await sb.from('saccoMembers').select('*');
  const { data: investors } = await sb.from('saccoInvestors').select('*');
  console.log('Members count:', members.length);
  console.log('Investors count:', investors.length);

  // Check how many investors have names
  const invWithNames = investors.filter(i => !!i.name);
  console.log('Investors with name column populated:', invWithNames.length);

  // Check how many members have "Investor" in their category
  const investorMembers = members.filter(m => {
    let cats = m.category;
    if (typeof cats === 'string') {
      try { cats = JSON.parse(cats); } catch { cats = [cats]; }
    }
    if (!Array.isArray(cats)) cats = [cats];
    return cats.some(c => c && (c.includes('Investor') || c.includes('Money Maker') || c.includes('New Farmer')));
  });
  console.log('Members with Investor/Money Maker/New Farmer in category:', investorMembers.length);

  // Check how many members have an investor record
  const memberIdSet = new Set(members.map(m => m.id));
  const invWithMemberId = investors.filter(i => memberIdSet.has(i.memberId));
  console.log('Investors whose memberId is in saccoMembers:', invWithMemberId.length);

  // Check for members who have an investor record but their total or money is 0
  const invMap = new Map();
  investors.forEach(i => {
    if (i.memberId) invMap.set(i.memberId, i);
  });

  const membersWithInv = members.filter(m => invMap.has(m.id));
  console.log('Members who have an investor record:', membersWithInv.length);

  const sample = membersWithInv.slice(0, 5).map(m => {
    const inv = invMap.get(m.id);
    return {
      name: m.name,
      memberCategory: m.category,
      memberTotal: m.total,
      investorAmount: inv.investmentAmount,
      investorType: inv.investorType
    };
  });
  console.log('Sample matched members with investor data:', sample);
}
main().catch(console.error);
