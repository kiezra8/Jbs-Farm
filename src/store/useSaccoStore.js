import { create } from 'zustand'
import { db } from '../db/schema'
import { format } from 'date-fns'

export const useSaccoStore = create((set, get) => ({
  members: [],
  shares: [],
  investors: [],
  transactions: [],
  savings: [],
  loading: false,

  loadSaccoData: async () => {
    set({ loading: true })
    let [members, shares, investors, transactions, savings] = await Promise.all([
      db.saccoMembers.toArray(),
      db.saccoShares.toArray(),
      db.saccoInvestors.toArray(),
      db.saccoTransactions.toArray(),
      db.saccoSavings.toArray()
    ])

    // Enforce "minimum one share" rule. Auto-heal any records with < 1 shares.
    const now = new Date().toISOString()
    const healedShares = []
    
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

    set({ members, shares, investors, transactions, savings, loading: false })
  },

  addMember: async (member) => {
    const now = new Date().toISOString()
    const id = crypto.randomUUID()
    const record = { ...member, id, createdAt: now }
    await db.saccoMembers.add(record)
    
    // Create initial shares record - MINIMUM 1 share
    const shareId = crypto.randomUUID()
    const shareRecord = { id: shareId, memberId: id, shareCount: 1, createdAt: now }
    await db.saccoShares.add(shareRecord)

    // Create initial savings record
    const savingId = crypto.randomUUID()
    const savingRecord = { id: savingId, memberId: id, savingAmount: 0, updatedAt: now }
    await db.saccoSavings.add(savingRecord)

    // If Category is Investor, also initialize Investor record with default 8M investment
    if (member.category === 'Investor') {
      const invId = crypto.randomUUID()
      const invRecord = {
        id: invId,
        memberId: id,
        category: 'Money Maker',
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

  updateMember: async (id, data) => {
    await db.saccoMembers.update(id, data)
    
    // Handle investor record initialization/deletion if category changes
    const existingInv = get().investors.find(i => i.memberId === id)
    if (data.category === 'Investor' && !existingInv) {
      const invId = crypto.randomUUID()
      await db.saccoInvestors.add({
        id: invId,
        memberId: id,
        category: 'Money Maker',
        investmentAmount: 8000000,
        moneyMakerAmount: 350000,
        cowsPerYear: 0,
        createdAt: new Date().toISOString()
      })
    } else if (data.category !== 'Investor' && existingInv) {
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

  importFromExcel: async (rows) => {
    // rows is an array of objects: { Name, Phone, NIN, Category, Shares, Savings, InvestmentAmount }
    const now = new Date().toISOString()
    
    for (const row of rows) {
      const memberId = crypto.randomUUID()
      const memberRecord = {
        id: memberId,
        name: row.Name || 'Imported Member',
        phone: row.Phone || '',
        nin: row.NIN || '',
        category: row.Category || 'Saving Member', // Pioneer, Investor, Saving Member
        photo: '',
        createdAt: now
      }
      
      await db.saccoMembers.add(memberRecord)

      // Create shares record - MINIMUM 1 share
      const shareId = crypto.randomUUID()
      const shareCount = Math.max(1, Number(row.Shares) || 1)
      const shareRecord = {
        id: shareId,
        memberId,
        shareCount,
        createdAt: now
      }
      await db.saccoShares.add(shareRecord)

      // Create savings record
      const savingId = crypto.randomUUID()
      const savingAmount = Number(row.Savings) || 0
      const savingRecord = {
        id: savingId,
        memberId,
        savingAmount,
        updatedAt: now
      }
      await db.saccoSavings.add(savingRecord)

      // If category is Investor
      if (memberRecord.category === 'Investor') {
        const invId = crypto.randomUUID()
        const investment = Number(row.InvestmentAmount) || 8000000
        const moneyMakerPayout = Math.round((investment / 8000000) * 350000)
        
        await db.saccoInvestors.add({
          id: invId,
          memberId,
          category: 'Money Maker',
          investmentAmount: investment,
          moneyMakerAmount: moneyMakerPayout,
          cowsPerYear: 0,
          createdAt: now
        })
      }
    }

    await get().loadSaccoData()
  },

  getFinancials: () => {
    const { transactions, shares, savings } = get()
    
    let moneyInBank = 0
    let pettyCash = 0
    let totalUsed = 0

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

    // Shares total value: each share costs 100K UGX.
    const totalShares = shares.reduce((sum, s) => sum + (s.shareCount || 0), 0)
    const totalSharesValue = totalShares * 100000

    // Savings total balance
    const totalSavings = savings.reduce((sum, s) => sum + (s.savingAmount || 0), 0)

    // Net balance calculation: cash in bank + petty cash.
    // Note: transaction sums represent actual ledger inputs/outputs.
    // Shares value and savings are considered liabilities/capital pool inside bank.
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
  }
}))
