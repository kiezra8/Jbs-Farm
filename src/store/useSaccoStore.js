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

  clearDatabase: async () => {
    set({ loading: true })
    await Promise.all([
      db.saccoMembers.clear(),
      db.saccoShares.clear(),
      db.saccoInvestors.clear(),
      db.saccoTransactions.clear(),
      db.saccoSavings.clear(),
      db.saccoYearlySavings.clear()
    ])
    set({ members: [], shares: [], investors: [], transactions: [], savings: [], yearlySavings: [], loading: false })
  },

  clearPhase3Investors: async () => {
    set({ loading: true })
    const allInvestors = await db.saccoInvestors.toArray()
    const phase3Investors = allInvestors.filter(i => i.investmentPhase === 'Phase 3')
    if (phase3Investors.length > 0) {
      await db.saccoInvestors.bulkDelete(phase3Investors.map(i => i.id))
      
      // Also clean up members that were strictly created from Phase 3 import
      const allMembers = await db.saccoMembers.toArray()
      const phase3MemberIds = phase3Investors.map(i => i.memberId)
      
      // Optional: Delete the members, shares, and savings of those who were ONLY Phase 3 investors
      // For safety, we just delete their investor records. The user wants the 126 Phase 3 investors gone.
      // If we need to delete the member as well to clean up:
      const membersToDelete = allMembers.filter(m => phase3MemberIds.includes(m.id) && m.sheetSource === 'PHASE 3')
      if (membersToDelete.length > 0) {
        await db.saccoMembers.bulkDelete(membersToDelete.map(m => m.id))
        
        const sharesToDelete = await db.saccoShares.where('memberId').anyOf(membersToDelete.map(m => m.id)).toArray()
        if (sharesToDelete.length > 0) await db.saccoShares.bulkDelete(sharesToDelete.map(s => s.id))

        const savingsToDelete = await db.saccoSavings.where('memberId').anyOf(membersToDelete.map(m => m.id)).toArray()
        if (savingsToDelete.length > 0) await db.saccoSavings.bulkDelete(savingsToDelete.map(s => s.id))
      }
    }
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
      const cleanM = getSortedWords(m.name)
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
        const cleanM = getSortedWords(m.name)
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

    // 2. Admin fee is read directly from Excel — no enforcement override.

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
      
      let parsedCategory = [];
      if (Array.isArray(m.category)) {
        parsedCategory = m.category;
      } else if (typeof m.category === 'string') {
        try {
          if (m.category.trim().startsWith('[')) {
            parsedCategory = JSON.parse(m.category);
          } else {
            parsedCategory = m.category.split(',').map(c => c.trim()).filter(Boolean);
          }
        } catch (_) {
          parsedCategory = [m.category];
        }
      }
      if (parsedCategory.length === 0) {
        parsedCategory = ['Saving Member'];
      }

      return {
        ...m,
        category: parsedCategory,
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
      memberId: memberObj.id,
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
    await db.saccoInvestors.update(id, data)
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

  getMemberTransactions: (memberId) => {
    return get().transactions
      .filter(t => t.memberId === memberId)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
  },

  importFromExcel: async (rows, financialYear = '2026', sheetName = '') => {
    const now = new Date().toISOString()
    const existingMembers = await db.saccoMembers.toArray()
    
    // We expect the excel file to have specific keys based on the sheet structure
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      
      // ── Name extraction differs per sheet ──────────────────────────────────
      // GENERAL MEMBERSHIP / JUNE MEMBERSHIP: name in "JB'S TEAM..." key
      // PIONEER: name in __EMPTY key, SN/NO in first key
      // PHASE 3:  name in __EMPTY key, NO in first key
      let nameVal
      if (sheetName === 'PIONEER' || sheetName === 'PHASE 3') {
        nameVal = row['__EMPTY']
      } else {
        nameVal = row["JB'S TEAM 100 MODERN FARMERS SACCO FULLY PAID  SACCO MEMBERS."] || row.NAMES || row.Name
      }
      // Skip header/empty rows
      if (!nameVal || typeof nameVal !== 'string') continue
      const cleanedName = cleanName(nameVal)
      if (!cleanedName || cleanedName === 'NAMES' || cleanedName === 'NAME') continue

      const parseNum = (val) => Number(val) || 0

      // ── Category ────────────────────────────────────────────────────────────
      let categoryArray = []
      if (sheetName === 'PHASE 3') {
        // PHASE 3: category is in __EMPTY_1 column
        const cat = (row['__EMPTY_1'] || '').toString().trim()
        categoryArray = cat ? [cat === 'NEW FARMER' ? 'New Farmer' : cat] : ['Investor']
      } else if (sheetName === 'PIONEER') {
        categoryArray = ['Pioneer']
      } else if (row.Category) {
        if (Array.isArray(row.Category)) {
          categoryArray = row.Category
        } else {
          categoryArray = String(row.Category).split(',').map(c => c.trim()).filter(Boolean)
        }
      }
      if (categoryArray.length === 0) {
        categoryArray = ['Saving Member']
      }

      // ── Column layout differs per sheet ──────────────────────────────────
      // GENERAL MEMBERSHIP: __EMPTY=CORRECT_BALANCE, __EMPTY_1=JAN...DEC=__EMPTY_12, TOTAL=__EMPTY_13, SHARES=__EMPTY_14, ADMIN=__EMPTY_15, SAVINGS=__EMPTY_16, MANDATORY=__EMPTY_17, WITHDRAWABLE=__EMPTY_18, REQUESTED=__EMPTY_19, DIFFERENCE=__EMPTY_20, NO_OF_SHARE=__EMPTY_21
      // JUNE MEMBERSHIP:    (no CORRECT_BALANCE col) __EMPTY=JAN...DEC=__EMPTY_11, TOTAL=__EMPTY_12, SHARES=__EMPTY_13, ADMIN=__EMPTY_14, SAVINGS=__EMPTY_15, MANDATORY=__EMPTY_16, WITHDRAWABLE=__EMPTY_17, DIFFERENCE=__EMPTY_18, REQUESTED=__EMPTY_19, NO_OF_SHARE=__EMPTY_20
      // PIONEER:            __EMPTY=NAME, __EMPTY_1=QTR1 (savings), __EMPTY_2=ADMIN FEES, __EMPTY_3=BALANCE
      // PHASE 3:            __EMPTY=NAME, __EMPTY_1=CATEGORY, __EMPTY_2=AMOUNT(program), __EMPTY_3=PAID, __EMPTY_4=BALANCE
      const isJune    = sheetName === 'JUNE MEMBERSHIP'
      const isPioneer = sheetName === 'PIONEER'
      const isPhase3  = sheetName === 'PHASE 3'

      let jan=0, feb=0, mar=0, apr=0, may=0, jun=0, jul=0, aug=0, sep=0, oct=0, nov=0, dec=0
      let total=0, sharesAmt=0, admin=0, savings=0, mandatory=0, withdrawable=0, requested=0, difference=0, noOfShares=0, correctBalance=0

      if (isPioneer) {
        // PIONEER: QTR1 payment is in __EMPTY_1, ADMIN FEES in __EMPTY_2, BALANCE in __EMPTY_3
        savings      = parseNum(row['__EMPTY_1'])   // QTR 1 = savings amount paid
        admin        = parseNum(row['__EMPTY_2'])   // admin fees paid
        total        = savings
        correctBalance = parseNum(row['__EMPTY_3']) // outstanding balance
        noOfShares   = 1
      } else if (isPhase3) {
        // PHASE 3: AMOUNT=program cost, PAID=amount paid, BALANCE=remaining
        sharesAmt    = parseNum(row['__EMPTY_2'])   // program amount
        savings      = parseNum(row['__EMPTY_3'])   // amount paid
        difference   = parseNum(row['__EMPTY_4'])   // balance remaining
        total        = savings
        noOfShares   = 1
      } else if (isJune) {
        jan  = parseNum(row['__EMPTY'])
        feb  = parseNum(row['__EMPTY_1'])
        mar  = parseNum(row['__EMPTY_2'])
        apr  = parseNum(row['__EMPTY_3'])
        may  = parseNum(row['__EMPTY_4'])
        jun  = parseNum(row['__EMPTY_5'])
        jul  = parseNum(row['__EMPTY_6'])
        aug  = parseNum(row['__EMPTY_7'])
        sep  = parseNum(row['__EMPTY_8'])
        oct  = parseNum(row['__EMPTY_9'])
        nov  = parseNum(row['__EMPTY_10'])
        dec  = parseNum(row['__EMPTY_11'])
        total        = parseNum(row['__EMPTY_12'])
        sharesAmt    = parseNum(row['__EMPTY_13'])
        admin        = parseNum(row['__EMPTY_14'])
        savings      = parseNum(row['__EMPTY_15'])
        mandatory    = parseNum(row['__EMPTY_16'])
        withdrawable = parseNum(row['__EMPTY_17'])
        difference   = parseNum(row['__EMPTY_18'])
        requested    = parseNum(row['__EMPTY_19'])
        noOfShares   = parseNum(row['__EMPTY_20'])
        correctBalance = 0
      } else {
        // GENERAL MEMBERSHIP
        correctBalance = parseNum(row['__EMPTY'])
        jan  = parseNum(row['__EMPTY_1'])
        feb  = parseNum(row['__EMPTY_2'])
        mar  = parseNum(row['__EMPTY_3'])
        apr  = parseNum(row['__EMPTY_4'])
        may  = parseNum(row['__EMPTY_5'])
        jun  = parseNum(row['__EMPTY_6'])
        jul  = parseNum(row['__EMPTY_7'])
        aug  = parseNum(row['__EMPTY_8'])
        sep  = parseNum(row['__EMPTY_9'])
        oct  = parseNum(row['__EMPTY_10'])
        nov  = parseNum(row['__EMPTY_11'])
        dec  = parseNum(row['__EMPTY_12'])
        total        = parseNum(row['__EMPTY_13'])
        sharesAmt    = parseNum(row['__EMPTY_14'])
        admin        = parseNum(row['__EMPTY_15'])
        savings      = parseNum(row['__EMPTY_16'])
        mandatory    = parseNum(row['__EMPTY_17'])
        withdrawable = parseNum(row['__EMPTY_18'])
        requested    = parseNum(row['__EMPTY_19'])
        difference   = parseNum(row['__EMPTY_20'])
        noOfShares   = parseNum(row['__EMPTY_21'])
      }

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
          correctBalance, total, shares: sharesAmt,
          admin, savings, mandatory, withdrawable, requested, difference, noOfShares,
          category: mergedCats
        })
        existingMember.category = mergedCats

        // Also update the shares table with the correct count from the Excel
        if (noOfShares > 0) {
          const existingShare = await db.saccoShares.where('memberId').equals(memberId).first()
          if (existingShare) {
            await db.saccoShares.update(existingShare.id, { shareCount: Math.max(1, noOfShares) })
          } else {
            await db.saccoShares.add({ id: crypto.randomUUID(), memberId, shareCount: Math.max(1, noOfShares), createdAt: now })
          }
        }
        
        // Also update savings table with the correct amount from the Excel
        const existingSaving = await db.saccoSavings.where('memberId').equals(memberId).first()
        if (existingSaving) {
          await db.saccoSavings.update(existingSaving.id, { savingAmount: savings || existingSaving.savingAmount, updatedAt: now })
        }
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
          total, shares: sharesAmt,
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

        // If category contains Investor or New Farmer (PHASE 3)
        if (categoryArray.includes('Investor') || categoryArray.includes('New Farmer')) {
          // For PHASE 3: sharesAmt = program amount, savings = amount paid, difference = balance
          const programAmt  = isPhase3 ? sharesAmt : 8000000
          const paidAmt     = isPhase3 ? savings   : 8000000
          const balanceAmt  = isPhase3 ? difference : 0
          const investorType = categoryArray.includes('New Farmer') ? 'New Farmer' : 'Money Maker'
          const moneyMakerPayout = Math.round((programAmt / 8000000) * 350000)
          const isCleared = balanceAmt === 0 && paidAmt > 0
          await db.saccoInvestors.add({
            id: crypto.randomUUID(), memberId,
            name: cleanedName,
            category: investorType,
            investorType,
            investmentPhase: 'Phase 3',
            programAmount: programAmt,
            investmentAmount: paidAmt,
            balance: balanceAmt,
            moneyMakerAmount: moneyMakerPayout,
            cowsPerYear: 0,
            status: isCleared ? 'CLEARED' : 'PENDING',
            createdAt: now
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
  },

  importInvestmentExcel: async (data) => {
    set({ loading: true })
    const now = new Date().toISOString()
    const members = await db.saccoMembers.toArray()
    
    // Skip empty rows and the header row
    const actualData = data.filter(row => row['__EMPTY'] && row['__EMPTY'] !== 'NAMES')

    for (const row of actualData) {
      const nameVal = String(row['__EMPTY']).trim()
      if (!nameVal) continue

      let matchedMember = findMatchingMember(members, nameVal)
      let memberId

      if (!matchedMember) {
        memberId = crypto.randomUUID()
        const memberRecord = {
          id: memberId, name: cleanName(nameVal), phone: '', nin: '', category: ['Investor'], photo: '',
          correctBalance: 0, jan: 0, feb: 0, mar: 0, apr: 0, may: 0, jun: 0, jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0,
          total: 50000, shares: 0, admin: 50000, savings: 0, mandatory: 0, withdrawable: 0, requested: 0, difference: 0, noOfShares: 0,
          createdAt: now
        }
        await db.saccoMembers.add(memberRecord)
        members.push(memberRecord)
        await db.saccoShares.add({ id: crypto.randomUUID(), memberId, shareCount: 1, createdAt: now })
        await db.saccoSavings.add({ id: crypto.randomUUID(), memberId, savingAmount: 0, updatedAt: now })
      } else {
        memberId = matchedMember.id
        const existingCats = Array.isArray(matchedMember.category) ? matchedMember.category : [matchedMember.category || 'Saving Member']
        if (!existingCats.includes('Investor')) {
          await db.saccoMembers.update(memberId, { category: [...existingCats, 'Investor'] })
        }
      }

      await db.saccoInvestors.add({
        id: crypto.randomUUID(),
        memberId,
        category: 'Money Maker',
        investorType: 'Money Maker',
        investmentPhase: 'Phase 1 & 2',
        marketingStrategy: false,
        investmentAmount: Number(row['__EMPTY_2']) || 0,
        programAmount: Number(row['__EMPTY_1']) || 0,
        balance: Number(row['__EMPTY_3']) || 0,
        status: row['__EMPTY_4'] || '',
        cowsPerYear: 0,
        createdAt: now
      })
    }
    await get().loadSaccoData()
  }
}))
