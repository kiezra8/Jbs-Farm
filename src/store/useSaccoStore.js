import { create } from 'zustand'
import { db } from '../db/schema'
import { format } from 'date-fns'

const cleanName = (name) => {
  if (!name) return '';
  let n = name;
  n = n.replace(/✅/g, '');
  n = n.replace(/bal\.?\s*\d+[\d\.,]*\s*[m]?(illion)?/gi, '');
  n = n.replace(/\b\d+[\d\.,]*\s*m\b/gi, '');
  n = n.replace(/\bbal\b.*/gi, '');
  n = n.replace(/[\-\–\—]/g, ' ');
  n = n.replace(/^(mr\.|mrs\.|ms\.|dr\.|mr|mrs|ms|dr)\b/gi, '');
  n = n.replace(/[\.\,\(\)\&\:\/\;\*\?\"\']/g, ' ');
  n = n.replace(/\b(and|with|or)\b/gi, ' ');
  n = n.replace(/\s+/g, ' ');
  return n.trim();
};

const getSortedWords = (name) => {
  return cleanName(name).toLowerCase().split(' ').filter(w => w.length > 1).sort().join(' ');
};

const findMatchingMember = (members, targetName) => {
  if (!targetName) return null;
  const targetCleaned = cleanName(targetName);
  const targetSorted = getSortedWords(targetName);

  return members.find(m => {
    if (!m.name) return false;
    const mCleaned = cleanName(m.name);
    if (mCleaned.toLowerCase() === targetCleaned.toLowerCase()) return true;

    const mSorted = getSortedWords(m.name);
    if (mSorted === targetSorted && targetSorted.length > 0) return true;

    const mWords = mSorted.split(' ');
    const targetWords = targetSorted.split(' ');
    if (mWords.length > 0 && targetWords.length > 0 && Math.abs(mWords.length - targetWords.length) <= 1) {
      return targetWords.every(targetW => 
        mWords.some(mW => mW.startsWith(targetW) || targetW.startsWith(mW))
      );
    }

    return false;
  }) || null;
};


export const useSaccoStore = create((set, get) => ({
  members: [],
  shares: [],
  investors: [],
  transactions: [],
  savings: [],
  yearlySavings: [],
  selectedYear: '2026',
  loading: false,

  setSelectedYear: async (year) => {
    set({ selectedYear: String(year) })
    await get().loadSaccoData()
  },

  loadSaccoData: async () => {
    set({ loading: true })
    let [members, shares, investors, transactions, savings, yearlySavings] = await Promise.all([
      db.saccoMembers.toArray(),
      db.saccoShares.toArray(),
      db.saccoInvestors.toArray(),
      db.saccoTransactions.toArray(),
      db.saccoSavings.toArray(),
      db.saccoYearlySavings.toArray()
    ])

    // Auto-seed data if members are empty
    if (members.length === 0) {
      try {
        const seedModule = await import('../db/sacco_seed.json');
        const seedData = seedModule.default || seedModule;
        await get().importFromExcel(seedData);
        // importFromExcel already calls loadSaccoData, so we can return early to prevent duplicates
        return;
      } catch (err) {
        console.error("Failed to load initial sacco seed data:", err);
      }
    }

    // Auto-seed investors if investor table is empty
    if (investors.length === 0) {
      try {
        const invModule = await import('../db/investors_seed.json');
        const invData = (invModule.default || invModule);
        const now = new Date().toISOString();
        for (const inv of invData) {
          if (!inv.name) continue;
          // Check if a matching member already exists using robust fuzzy matching
          let matchedMember = findMatchingMember(members, inv.name);
          let memberId;
          if (!matchedMember) {
            // Create a placeholder member marked as Investor
            memberId = crypto.randomUUID();
            const memberRecord = {
              id: memberId,
              name: cleanName(inv.name),
              phone: '',
              nin: '',
              category: ['Investor'],
              photo: '',
              correctBalance: 0, jan: 0, feb: 0, mar: 0, apr: 0, may: 0, jun: 0,
              jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0,
              total: 0, shares: 0, admin: 0, savings: 0, mandatory: 0,
              withdrawable: 0, requested: 0, difference: 0, noOfShares: 0,
              createdAt: now
            };
            await db.saccoMembers.add(memberRecord);
            members.push(memberRecord);
            // Create linked shares + savings
            await db.saccoShares.add({ id: crypto.randomUUID(), memberId, shareCount: 1, createdAt: now });
            await db.saccoSavings.add({ id: crypto.randomUUID(), memberId, savingAmount: 0, updatedAt: now });
          } else {
            memberId = matchedMember.id;
            // Update member category to include Investor
            const existingCats = Array.isArray(matchedMember.category) ? matchedMember.category : [matchedMember.category || 'Saving Member'];
            if (!existingCats.includes('Investor')) {
              await db.saccoMembers.update(memberId, { category: [...existingCats, 'Investor'] });
            }
          }
          // Create the investor record
          const invRecord = {
            id: crypto.randomUUID(),
            memberId,
            category: inv.investorType || 'Money Maker',
            investorType: inv.investorType || 'Money Maker',
            investmentPhase: inv.investmentPhase || 'Phase 3',
            marketingStrategy: inv.marketingStrategy || false,
            investmentAmount: inv.paid || 0,   // actual paid amount
            programAmount: inv.program || 0,   // total program target
            balance: inv.balance || 0,
            status: inv.status || (inv.cleared ? 'CLEARED' : ''),
            cowsPerYear: 0,
            createdAt: now
          };
          await db.saccoInvestors.add(invRecord);
        }
        console.log(`Auto-seeded ${invData.length} investors`);
      } catch (err) {
        console.error("Failed to load investor seed data:", err);
      }
      // Reload after seeding
      return get().loadSaccoData();
    }
    // Enforce "minimum one share" rule. Auto-heal any records with < 1 shares.
    const now = new Date().toISOString()
    
    // Check if every member has a shares and savings record. If not, create them.
    for (const member of members) {
      let share = shares.find(s => s.memberId === member.id)
      if (!share) {
        const id = crypto.randomUUID()
        const newShare = { id, memberId: member.id, shareCount: 1, createdAt: now }
        await db.saccoShares.add(newShare)
        shares.push(newShare)
      } else if (share.shareCount < 1) {
        await db.saccoShares.update(share.id, { shareCount: 1 })
        share.shareCount = 1
      }

      let saving = savings.find(s => s.memberId === member.id)
      if (!saving) {
        const id = crypto.randomUUID()
        const newSaving = { id, memberId: member.id, savingAmount: 0, updatedAt: now }
        await db.saccoSavings.add(newSaving)
        savings.push(newSaving)
      }
    }

    // 1. Merge duplicate members if any exist (runs once on startup)
    const uniqueNames = {}
    let hasDuplicates = false
    for (const m of members) {
      if (!m.name || m.sheetSource === 'PHASE 3') continue
      const cleanM = cleanName(m.name).toLowerCase()
      if (uniqueNames[cleanM]) {
        hasDuplicates = true
        break
      }
      uniqueNames[cleanM] = true
    }

    if (hasDuplicates) {
      console.log("⚠️ Found duplicate member records! Merging them...")
      const processedCleanNames = {}
      for (const m of members) {
        if (!m.name || m.sheetSource === 'PHASE 3') continue
        const cleanM = cleanName(m.name).toLowerCase()
        if (processedCleanNames[cleanM]) {
          const primary = processedCleanNames[cleanM]
          const primaryCats = Array.isArray(primary.category) ? primary.category : [primary.category || 'Saving Member']
          const duplicateCats = Array.isArray(m.category) ? m.category : [m.category || 'Saving Member']
          const newCats = Array.from(new Set([...primaryCats, ...duplicateCats]))
          primary.category = newCats

          if (!primary.phone) primary.phone = m.phone
          if (!primary.nin) primary.nin = m.nin
          if (!primary.photo) primary.photo = m.photo

          await db.saccoMembers.update(primary.id, {
            category: newCats,
            phone: primary.phone,
            nin: primary.nin,
            photo: primary.photo
          })

          const userShares = await db.saccoShares.where({ memberId: m.id }).toArray()
          for (const s of userShares) await db.saccoShares.update(s.id, { memberId: primary.id })

          const userSavings = await db.saccoSavings.where({ memberId: m.id }).toArray()
          for (const s of userSavings) await db.saccoSavings.update(s.id, { memberId: primary.id })

          const userInvestors = await db.saccoInvestors.where({ memberId: m.id }).toArray()
          for (const i of userInvestors) await db.saccoInvestors.update(i.id, { memberId: primary.id })

          const userYearlySavings = await db.saccoYearlySavings.where({ memberId: m.id }).toArray()
          for (const y of userYearlySavings) await db.saccoYearlySavings.update(y.id, { memberId: primary.id })

          await db.saccoMembers.delete(m.id)
        } else {
          processedCleanNames[cleanM] = m
        }
      }
      // Re-fetch everything after merging
      members = await db.saccoMembers.toArray()
      shares = await db.saccoShares.toArray()
      investors = await db.saccoInvestors.toArray()
      savings = await db.saccoSavings.toArray()
      yearlySavings = await db.saccoYearlySavings.toArray()
    }

    // 2. Ensure all members have paid the admin fee of 50,000
    for (const m of members) {
      if ((m.admin || 0) < 50000) {
        await db.saccoMembers.update(m.id, { admin: 50000, total: Math.max(50000, m.total || 0) })
        m.admin = 50000
        m.total = Math.max(50000, m.total || 0)
      }
    }

    // 3. Migrate any existing members' monthly data to saccoYearlySavings (for 2026)
    const selectedYear = get().selectedYear || '2026'
    if (yearlySavings.length === 0 && members.length > 0) {
      const nowNow = new Date().toISOString()
      for (const m of members) {
        const hasData = m.jan || m.feb || m.mar || m.apr || m.may || m.jun || m.jul || m.aug || m.sep || m.oct || m.nov || m.dec
        if (hasData) {
          await db.saccoYearlySavings.add({
            id: crypto.randomUUID(),
            memberId: m.id,
            year: '2026',
            jan: m.jan || 0,
            feb: m.feb || 0,
            mar: m.mar || 0,
            apr: m.apr || 0,
            may: m.may || 0,
            jun: m.jun || 0,
            jul: m.jul || 0,
            aug: m.aug || 0,
            sep: m.sep || 0,
            oct: m.oct || 0,
            nov: m.nov || 0,
            dec: m.dec || 0,
            total: m.total || 0,
            createdAt: nowNow
          })
        }
      }
      yearlySavings = await db.saccoYearlySavings.toArray()
    }

    // 4. Map the selected year's savings onto the member objects
    const mappedMembers = members.map(m => {
      const yearly = yearlySavings.find(y => y.memberId === m.id && String(y.year) === selectedYear)
      return {
        ...m,
        jan: yearly?.jan || 0,
        feb: yearly?.feb || 0,
        mar: yearly?.mar || 0,
        apr: yearly?.apr || 0,
        may: yearly?.may || 0,
        jun: yearly?.jun || 0,
        jul: yearly?.jul || 0,
        aug: yearly?.aug || 0,
        sep: yearly?.sep || 0,
        oct: yearly?.oct || 0,
        nov: yearly?.nov || 0,
        dec: yearly?.dec || 0,
        total: yearly?.total || 0
      }
    })

    set({ members: mappedMembers, shares, investors, transactions, savings, yearlySavings, loading: false })
  },

  importInvestors: async () => {
    set({ loading: true })
    try {
      // Delete existing to trigger sync hooks
      const oldInvestors = await db.saccoInvestors.toArray()
      if (oldInvestors.length > 0) {
        await db.saccoInvestors.bulkDelete(oldInvestors.map(i => i.id))
      }

      const invModule = await import('../db/investors_seed.json')
      const invData = invModule.default || invModule
      const members = await db.saccoMembers.toArray()
      const now = new Date().toISOString()

      for (const inv of invData) {
        if (!inv.name) continue

        // Match existing member using robust fuzzy matching
        let matchedMember = findMatchingMember(members, inv.name);
        let memberId

        if (!matchedMember) {
          // Create new member placeholder
          memberId = crypto.randomUUID()
          const memberRecord = {
            id: memberId, name: cleanName(inv.name), phone: '', nin: '',
            category: ['Investor'], photo: '',
            correctBalance: 0, jan: 0, feb: 0, mar: 0, apr: 0, may: 0, jun: 0,
            jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0,
            total: 50000, shares: 0, admin: 50000, savings: 0, mandatory: 0,
            withdrawable: 0, requested: 0, difference: 0, noOfShares: 0,
            createdAt: now
          }
          await db.saccoMembers.add(memberRecord)
          // Create linked shares + savings
          await db.saccoShares.add({ id: crypto.randomUUID(), memberId, shareCount: 1, createdAt: now })
          await db.saccoSavings.add({ id: crypto.randomUUID(), memberId, savingAmount: 0, updatedAt: now })
        } else {
          memberId = matchedMember.id
          // Ensure Investor is in their categories
          const existingCats = Array.isArray(matchedMember.category) ? matchedMember.category : [matchedMember.category || 'Saving Member']
          if (!existingCats.includes('Investor')) {
            await db.saccoMembers.update(memberId, { category: [...existingCats, 'Investor'] })
          }
        }

        await db.saccoInvestors.add({
          id: crypto.randomUUID(),
          memberId,
          category: inv.investorType || 'Money Maker',
          investorType: inv.investorType || 'Money Maker',
          investmentPhase: inv.investmentPhase || 'Phase 3',
          marketingStrategy: inv.marketingStrategy || false,
          investmentAmount: inv.paid || 0,
          programAmount: inv.program || 0,
          balance: inv.balance || 0,
          status: inv.status || (inv.cleared ? 'CLEARED' : ''),
          cowsPerYear: 0,
          createdAt: now
        })
      }
      console.log(`Imported ${invData.length} investors successfully`)
    } catch (err) {
      console.error('Failed to import investors:', err)
    }
    return get().loadSaccoData()
  },

  addMember: async (member, financialYear = '2026') => {
    const now = new Date().toISOString()
    const id = crypto.randomUUID()
    
    // Ensure category is an array for multiple selections
    const categoryArray = Array.isArray(member.category) ? member.category : [member.category || 'Saving Member']
    const record = { ...member, category: categoryArray, id, createdAt: now }
    
    await db.saccoMembers.add(record)
    
    // Create initial shares record - MINIMUM 1 share
    const shareId = crypto.randomUUID()
    const shareRecord = { id: shareId, memberId: id, shareCount: member.noOfShares || 1, createdAt: now }
    await db.saccoShares.add(shareRecord)

    // Create initial savings record
    const savingId = crypto.randomUUID()
    const savingRecord = { id: savingId, memberId: id, savingAmount: member.total || 0, updatedAt: now }
    await db.saccoSavings.add(savingRecord)

    // Save yearly data for the selected financial year
    await db.saccoYearlySavings.add({
      id: crypto.randomUUID(),
      memberId: id,
      year: financialYear,
      jan: member.jan || 0, feb: member.feb || 0, mar: member.mar || 0,
      apr: member.apr || 0, may: member.may || 0, jun: member.jun || 0,
      jul: member.jul || 0, aug: member.aug || 0, sep: member.sep || 0,
      oct: member.oct || 0, nov: member.nov || 0, dec: member.dec || 0,
      total: member.total || 0,
      createdAt: now
    })

    // If Category includes Investor, initialize Investor record
    if (categoryArray.includes('Investor')) {
      const invId = crypto.randomUUID()
      const invRecord = {
        id: invId,
        memberId: id,
        category: 'Money Maker', 
        investorType: 'Money Maker',
        investmentPhase: 'Initial',
        marketingStrategy: false,
        investmentAmount: 8000000,
        moneyMakerAmount: 350000,
        cowsPerYear: 0,
        createdAt: now
      }
      await db.saccoInvestors.add(invRecord)
    }

    await get().loadSaccoData()
    return record
  },

  updateMember: async (id, data, financialYear = '2026') => {
    const categoryArray = Array.isArray(data.category) ? data.category : [data.category || 'Saving Member']
    const updatedData = { ...data, category: categoryArray }
    
    await db.saccoMembers.update(id, updatedData)
    
    // Update or create yearly data
    const existingYearly = await db.saccoYearlySavings.where({ memberId: id }).toArray()
    const yearEntry = existingYearly.find(y => String(y.year) === String(financialYear))
    
    if (yearEntry) {
      await db.saccoYearlySavings.update(yearEntry.id, {
        jan: data.jan || 0, feb: data.feb || 0, mar: data.mar || 0,
        apr: data.apr || 0, may: data.may || 0, jun: data.jun || 0,
        jul: data.jul || 0, aug: data.aug || 0, sep: data.sep || 0,
        oct: data.oct || 0, nov: data.nov || 0, dec: data.dec || 0,
        total: data.total || 0
      })
    } else {
      await db.saccoYearlySavings.add({
        id: crypto.randomUUID(),
        memberId: id,
        year: financialYear,
        jan: data.jan || 0, feb: data.feb || 0, mar: data.mar || 0,
        apr: data.apr || 0, may: data.may || 0, jun: data.jun || 0,
        jul: data.jul || 0, aug: data.aug || 0, sep: data.sep || 0,
        oct: data.oct || 0, nov: data.nov || 0, dec: data.dec || 0,
        total: data.total || 0,
        createdAt: new Date().toISOString()
      })
    }
    
    // Handle investor record initialization/deletion if category changes
    const existingInv = get().investors.find(i => i.memberId === id)
    if (categoryArray.includes('Investor') && !existingInv) {
      const invId = crypto.randomUUID()
      await db.saccoInvestors.add({
        id: invId,
        memberId: id,
        category: 'Money Maker',
        investorType: 'Money Maker',
        investmentPhase: 'Initial',
        marketingStrategy: false,
        investmentAmount: 8000000,
        moneyMakerAmount: 350000,
        cowsPerYear: 0,
        createdAt: new Date().toISOString()
      })
    } else if (!categoryArray.includes('Investor') && existingInv) {
      await db.saccoInvestors.delete(existingInv.id)
    }

    await get().loadSaccoData()
  },

  deleteMember: async (id) => {
    await db.saccoMembers.delete(id)
    
    // Delete related shares
    const share = get().shares.find(s => s.memberId === id)
    if (share) await db.saccoShares.delete(share.id)

    // Delete related savings
    const saving = get().savings.find(s => s.memberId === id)
    if (saving) await db.saccoSavings.delete(saving.id)

    // Delete related investor info
    const inv = get().investors.find(i => i.memberId === id)
    if (inv) await db.saccoInvestors.delete(inv.id)

    await get().loadSaccoData()
  },

  updateShares: async (memberId, shareCount) => {
    const existing = get().shares.find(s => s.memberId === memberId)
    // Enforce minimum 1 share
    const count = Math.max(1, Number(shareCount) || 1)
    
    if (existing) {
      await db.saccoShares.update(existing.id, { shareCount: count })
    } else {
      await db.saccoShares.add({
        memberId,
        shareCount: count,
        createdAt: new Date().toISOString()
      })
    }
    await get().loadSaccoData()
  },

  updateSavings: async (memberId, savingAmount) => {
    const existing = get().savings.find(s => s.memberId === memberId)
    const amount = Number(savingAmount) || 0
    
    if (existing) {
      await db.saccoSavings.update(existing.id, { 
        savingAmount: amount,
        updatedAt: new Date().toISOString() 
      })
    } else {
      await db.saccoSavings.add({
        memberId,
        savingAmount: amount,
        updatedAt: new Date().toISOString()
      })
    }
    await get().loadSaccoData()
  },

  convertSavingsToShares: async (memberId, shareCountToBuy) => {
    const sharesObj = get().shares.find(s => s.memberId === memberId)
    const savingsObj = get().savings.find(s => s.memberId === memberId)
    const memberObj = get().members.find(m => m.id === memberId)
    
    if (!sharesObj || !savingsObj || !memberObj) return { success: false, error: 'Member records not found' }
    
    const countToBuy = Math.floor(Number(shareCountToBuy) || 0)
    if (countToBuy <= 0) return { success: false, error: 'Must buy at least 1 share' }
    
    const cost = countToBuy * 100000
    if (savingsObj.savingAmount < cost) {
      return { success: false, error: `Insufficient savings. Need ${cost.toLocaleString()} UGX but only have ${savingsObj.savingAmount.toLocaleString()} UGX.` }
    }
    
    // Deduct from savings
    const newSavingsAmount = savingsObj.savingAmount - cost
    await db.saccoSavings.update(savingsObj.id, {
      savingAmount: newSavingsAmount,
      updatedAt: new Date().toISOString()
    })
    
    // Add to shares
    const newSharesCount = sharesObj.shareCount + countToBuy
    await db.saccoShares.update(sharesObj.id, {
      shareCount: newSharesCount
    })
    
    // Add transaction to ledger
    await get().addTransaction({
      date: format(new Date(), 'yyyy-MM-dd'),
      type: 'Transfer',
      source: 'Bank',
      category: 'Share Purchase',
      amount: cost,
      description: `Converted ${cost.toLocaleString()} UGX savings to ${countToBuy} shares for ${memberObj.name}`
    })
    
    await get().loadSaccoData()
    return { success: true }
  },

  updateInvestor: async (id, data) => {
    // If investmentAmount is changed, auto-compute moneyMakerAmount = (investmentAmount / 8M) * 350K
    const updatedData = { ...data }
    if (data.investmentAmount !== undefined && data.category === 'Money Maker') {
      const amt = Number(data.investmentAmount) || 0
      updatedData.moneyMakerAmount = Math.round((amt / 8000000) * 350000)
    }
    await db.saccoInvestors.update(id, updatedData)
    await get().loadSaccoData()
  },

  addTransaction: async (tx) => {
    const id = crypto.randomUUID()
    const record = {
      ...tx,
      id,
      amount: Number(tx.amount) || 0,
      createdAt: new Date().toISOString()
    }
    await db.saccoTransactions.add(record)
    await get().loadSaccoData()
    return record
  },

  deleteTransaction: async (id) => {
    await db.saccoTransactions.delete(id)
    await get().loadSaccoData()
  },

  importFromExcel: async (rows, financialYear = '2026', sheetName = '') => {
    const now = new Date().toISOString()
    const existingMembers = await db.saccoMembers.toArray()
    
    // We expect the excel file to have specific keys based on the sheet structure
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      
      // Skip the header row if it's the first row
      const nameVal = row["JB'S TEAM 100 MODERN FARMERS SACCO FULLY PAID  SACCO MEMBERS."] || row.NAMES || row.Name
      if (nameVal === 'NAMES' || !nameVal || typeof nameVal !== 'string') continue

      const parseNum = (val) => Number(val) || 0

      let categoryArray = []
      if (row.Category) {
        if (Array.isArray(row.Category)) {
          categoryArray = row.Category
        } else {
          categoryArray = String(row.Category).split(',').map(c => c.trim()).filter(Boolean)
        }
      }
      if (categoryArray.length === 0) {
        if (sheetName === 'PHASE 3') {
          categoryArray = ['Investor']
        } else {
          categoryArray = ['Saving Member']
        }
      }

      const jan = parseNum(row["__EMPTY_1"] || row.JAN || row.Jan)
      const feb = parseNum(row["__EMPTY_2"] || row.FEB || row.Feb)
      const mar = parseNum(row["__EMPTY_3"] || row.MARCH || row.Mar || row.MARCH)
      const apr = parseNum(row["__EMPTY_4"] || row.APRIL || row.Apr)
      const may = parseNum(row["__EMPTY_5"] || row.MAY || row.May)
      const jun = parseNum(row["__EMPTY_6"] || row.JUNE || row.Jun)
      const jul = parseNum(row["__EMPTY_7"] || row.JULY || row.Jul)
      const aug = parseNum(row["__EMPTY_8"] || row.AUG || row.Aug)
      const sep = parseNum(row["__EMPTY_9"] || row.SEP || row.Sep)
      const oct = parseNum(row["__EMPTY_10"] || row.OCT || row.Oct)
      const nov = parseNum(row["__EMPTY_11"] || row.NOV || row.Nov)
      const dec = parseNum(row["__EMPTY_12"] || row.DEC || row.Dec)
      const total = parseNum(row["__EMPTY_13"] || row.TOTAL || row.Total)
      const noOfShares = parseNum(row["__EMPTY_21"] || row["NO OF SHARE"] || row.NoOfShares)
      const admin = Math.max(50000, parseNum(row["__EMPTY_15"] || row.ADMIN || row.Admin))
      const savings = parseNum(row["__EMPTY_16"] || row.SAVINGS || row.Savings)
      const mandatory = parseNum(row["__EMPTY_17"] || row.MANDATORY || row.Mandatory)
      const withdrawable = parseNum(row["__EMPTY_18"] || row["WITHDRAWABLE SAVING"] || row.Withdrawable)
      const requested = parseNum(row["__EMPTY_19"] || row.REQUESTED || row.Requested)
      const difference = parseNum(row["__EMPTY_20"] || row.DIFFERENCE || row.Difference)
      const correctBalance = parseNum(row["__EMPTY"] || row["CORRECT BALANCE AS AT 30TH JAN 2026"] || row.CorrectBalance)

      // Try to match existing member using fuzzy matching (skip for PHASE 3 to prevent mixing investors into general members)
      let existingMember = null
      if (sheetName !== 'PHASE 3') {
        existingMember = findMatchingMember(existingMembers, nameVal)
      }
      let memberId

      if (existingMember) {
        memberId = existingMember.id
        // Update member with latest data but keep categories merged
        const existingCats = Array.isArray(existingMember.category) ? existingMember.category : [existingMember.category || 'Saving Member']
        const mergedCats = Array.from(new Set([...existingCats, ...categoryArray]))
        await db.saccoMembers.update(memberId, {
          correctBalance, total, shares: parseNum(row["__EMPTY_14"] || row.SHARES),
          admin, savings, mandatory, withdrawable, requested, difference, noOfShares,
          category: mergedCats
        })
        existingMember.category = mergedCats
      } else {
        // Create new member record
        memberId = crypto.randomUUID()
        const memberRecord = {
          id: memberId,
          name: cleanName(nameVal),
          phone: row.Phone || '',
          nin: row.NIN || '',
          category: categoryArray,
          photo: '',
          correctBalance, jan, feb, mar, apr, may, jun, jul, aug, sep, oct, nov, dec,
          total, shares: parseNum(row["__EMPTY_14"] || row.SHARES || row.Shares),
          admin, savings, mandatory, withdrawable, requested, difference, noOfShares,
          sheetSource: sheetName,
          createdAt: now
        }
        await db.saccoMembers.add(memberRecord)
        existingMembers.push(memberRecord)

        // Maintain shares table
        const shareCount = Math.max(1, noOfShares || 1)
        await db.saccoShares.add({ id: crypto.randomUUID(), memberId, shareCount, createdAt: now })

        // Maintain savings table
        await db.saccoSavings.add({ id: crypto.randomUUID(), memberId, savingAmount: total || 0, updatedAt: now })

        // If category contains Investor
        if (categoryArray.includes('Investor')) {
          const investment = parseNum(row.InvestmentAmount) || 8000000
          const moneyMakerPayout = Math.round((investment / 8000000) * 350000)
          await db.saccoInvestors.add({
            id: crypto.randomUUID(), memberId, category: 'Money Maker',
            investorType: 'Money Maker', investmentAmount: investment,
            moneyMakerAmount: moneyMakerPayout, cowsPerYear: 0, createdAt: now
          })
        }
      }

      // Always write/update the yearly savings entry for this financial year
      const existingYearly = await db.saccoYearlySavings.where({ memberId }).toArray()
      const yearEntry = existingYearly.find(y => String(y.year) === String(financialYear))
      if (yearEntry) {
        await db.saccoYearlySavings.update(yearEntry.id, {
          jan, feb, mar, apr, may, jun, jul, aug, sep, oct, nov, dec, total
        })
      } else {
        await db.saccoYearlySavings.add({
          id: crypto.randomUUID(), memberId, year: financialYear,
          jan, feb, mar, apr, may, jun, jul, aug, sep, oct, nov, dec, total, createdAt: now
        })
      }
    }

    await get().loadSaccoData()
  },

  getFinancials: () => {
    const { transactions, shares, savings, investors } = get()
    
    let moneyInBank = 0
    let pettyCash = 0
    let totalUsed = 0

    // Get marketing strategy member IDs
    const marketingIds = investors.filter(i => i.marketingStrategy).map(i => i.memberId)

    // Calculations based on transactions
    transactions.forEach(tx => {
      const amt = Number(tx.amount) || 0
      if (tx.type === 'Income') {
        if (tx.source === 'Bank') {
          moneyInBank += amt
        } else if (tx.source === 'Petty Cash') {
          pettyCash += amt
        }
      } else if (tx.type === 'Expense') {
        totalUsed += amt
        if (tx.source === 'Bank') {
          moneyInBank -= amt
        } else if (tx.source === 'Petty Cash') {
          pettyCash -= amt
        }
      } else if (tx.type === 'Transfer') {
        if (tx.source === 'Bank') {
          moneyInBank -= amt
          pettyCash += amt
        } else {
          pettyCash -= amt
          moneyInBank += amt
        }
      }
    })

    // Shares total value: exclude marketing strategy members
    const validShares = shares.filter(s => !marketingIds.includes(s.memberId))
    const totalShares = validShares.reduce((sum, s) => sum + (s.shareCount || 0), 0)
    const totalSharesValue = totalShares * 100000

    // Savings total balance: exclude marketing strategy members
    const validSavings = savings.filter(s => !marketingIds.includes(s.memberId))
    const totalSavings = validSavings.reduce((sum, s) => sum + (s.savingAmount || 0), 0)

    const netBalance = moneyInBank + pettyCash + totalSharesValue + totalSavings

    return {
      moneyInBank: moneyInBank + totalSharesValue + totalSavings, 
      pettyCash,
      totalUsed,
      totalShares,
      totalSharesValue,
      totalSavings,
      netBalance
    }
  },

  exportToExcel: () => {
    const { members } = get()
    
    // Construct the rows array matching exactly the import format
    const rows = members.sort((a,b) => a.name.localeCompare(b.name)).map((m, index) => {
      return {
        "JB'S TEAM 100 MODERN FARMERS SACCO FULLY PAID  SACCO MEMBERS.": m.name,
        "__EMPTY": m.correctBalance || 0,
        "__EMPTY_1": m.jan || 0,
        "__EMPTY_2": m.feb || 0,
        "__EMPTY_3": m.mar || 0,
        "__EMPTY_4": m.apr || 0,
        "__EMPTY_5": m.may || 0,
        "__EMPTY_6": m.jun || 0,
        "__EMPTY_7": m.jul || 0,
        "__EMPTY_8": m.aug || 0,
        "__EMPTY_9": m.sep || 0,
        "__EMPTY_10": m.oct || 0,
        "__EMPTY_11": m.nov || 0,
        "__EMPTY_12": m.dec || 0,
        "__EMPTY_13": m.total || 0,
        "__EMPTY_14": m.shares || 0,
        "__EMPTY_15": m.admin || 0,
        "__EMPTY_16": m.savings || 0,
        "__EMPTY_17": m.mandatory || 0,
        "__EMPTY_18": m.withdrawable || 0,
        "__EMPTY_19": m.requested || 0,
        "__EMPTY_20": m.difference || 0,
        "__EMPTY_21": m.noOfShares || 0
      }
    })

    // Add the header row as the first row in the JSON array to mimic the weird empty header structure
    const headerRow = {
      "JB'S TEAM 100 MODERN FARMERS SACCO FULLY PAID  SACCO MEMBERS.": "NAMES",
      "__EMPTY": "CORRECT BALANCE AS AT 30TH JAN 2026",
      "__EMPTY_1": "JAN",
      "__EMPTY_2": "FEB",
      "__EMPTY_3": "MARCH",
      "__EMPTY_4": "APRIL",
      "__EMPTY_5": "MAY",
      "__EMPTY_6": "JUNE",
      "__EMPTY_7": "JULY",
      "__EMPTY_8": "AUG",
      "__EMPTY_9": "SEP",
      "__EMPTY_10": "OCT",
      "__EMPTY_11": "NOV",
      "__EMPTY_12": "DEC",
      "__EMPTY_13": "TOTAL",
      "__EMPTY_14": "SHARES",
      "__EMPTY_15": "ADMIN",
      "__EMPTY_16": "SAVINGS",
      "__EMPTY_17": "MANDATORY",
      "__EMPTY_18": "WITHDRAWABLE SAVING",
      "__EMPTY_19": "REQUESTED",
      "__EMPTY_20": "DIFFERENCE",
      "__EMPTY_21": "NO OF SHARE"
    }
    
    rows.unshift(headerRow)
    
    return rows
  }
}))
