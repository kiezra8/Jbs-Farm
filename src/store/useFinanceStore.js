import { create } from 'zustand'
import { db } from '../db/schema'
import { format, startOfMonth, endOfMonth } from 'date-fns'

// Push a finance record to Supabase (fire-and-forget, non-blocking)
async function pushFinanceToSupabase(record) {
  try {
    const { upsertSaccoRecord } = await import('../services/supabaseSyncEngine')
    await upsertSaccoRecord('finances', record)
  } catch (_) {}
}

async function deleteFinanceFromSupabase(id) {
  try {
    const { deleteSaccoRecord } = await import('../services/supabaseSyncEngine')
    await deleteSaccoRecord('finances', id)
  } catch (_) {}
}

export const useFinanceStore = create((set, get) => ({
  transactions: [],
  loading: false,

  loadTransactions: async () => {
    set({ loading: true })
    const transactions = await db.finances.orderBy('date').reverse().toArray()
    set({ transactions, loading: false })
  },

  addTransaction: async (data) => {
    const now = new Date().toISOString()
    const id = crypto.randomUUID()
    const record = { ...data, id, createdAt: now }
    await db.finances.add(record)
    const tx = await db.finances.get(id)
    set(s => ({ transactions: [tx, ...s.transactions] }))
    // Sync to Supabase for cross-device visibility
    pushFinanceToSupabase(tx)
    return tx
  },

  updateTransaction: async (id, data) => {
    await db.finances.update(id, { ...data, updatedAt: new Date().toISOString() })
    const tx = await db.finances.get(id)
    set(s => ({ transactions: s.transactions.map(t => t.id === id ? tx : t) }))
    // Sync to Supabase
    pushFinanceToSupabase(tx)
  },

  deleteTransaction: async (id) => {
    await db.finances.delete(id)
    set(s => ({ transactions: s.transactions.filter(t => t.id !== id) }))
    // Sync delete to Supabase
    deleteFinanceFromSupabase(id)
  },

  getMonthlyStats: (date = new Date()) => {
    const { transactions } = get()
    const start = format(startOfMonth(date), 'yyyy-MM-dd')
    const end = format(endOfMonth(date), 'yyyy-MM-dd')
    const monthly = transactions.filter(t => t.date >= start && t.date <= end)
    const income = monthly.filter(t => t.type === 'Income').reduce((sum, t) => sum + (t.amount || 0), 0)
    const expenses = monthly.filter(t => t.type === 'Expense').reduce((sum, t) => sum + (t.amount || 0), 0)
    return { income, expenses, profit: income - expenses }
  },

  getYearlyStats: (date = new Date()) => {
    const { transactions } = get()
    const yearPrefix = format(date, 'yyyy')
    const yearly = transactions.filter(t => t.date.startsWith(yearPrefix))
    const income = yearly.filter(t => t.type === 'Income').reduce((sum, t) => sum + (t.amount || 0), 0)
    const expenses = yearly.filter(t => t.type === 'Expense').reduce((sum, t) => sum + (t.amount || 0), 0)
    return { income, expenses, profit: income - expenses }
  },

  getDailyStats: (date = new Date()) => {
    const { transactions } = get()
    const todayStr = format(date, 'yyyy-MM-dd')
    const daily = transactions.filter(t => t.date === todayStr)
    const income = daily.filter(t => t.type === 'Income').reduce((sum, t) => sum + (t.amount || 0), 0)
    const expenses = daily.filter(t => t.type === 'Expense').reduce((sum, t) => sum + (t.amount || 0), 0)
    return { income, expenses, profit: income - expenses }
  },

  getCategoryBreakdown: () => {
    const { transactions } = get()
    const expenses = transactions.filter(t => t.type === 'Expense')
    const cats = {}
    expenses.forEach(t => {
      cats[t.category] = (cats[t.category] || 0) + t.amount
    })
    return Object.entries(cats).map(([name, value]) => ({ name, value }))
  },

  getMonthlyTrend: (months = 6) => {
    const { transactions } = get()
    const result = []
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date()
      d.setMonth(d.getMonth() - i)
      const start = format(startOfMonth(d), 'yyyy-MM-dd')
      const end = format(endOfMonth(d), 'yyyy-MM-dd')
      const monthly = transactions.filter(t => t.date >= start && t.date <= end)
      const income = monthly.filter(t => t.type === 'Income').reduce((sum, t) => sum + (t.amount || 0), 0)
      const expenses = monthly.filter(t => t.type === 'Expense').reduce((sum, t) => sum + (t.amount || 0), 0)
      result.push({ month: format(d, 'MMM'), income, expenses, profit: income - expenses })
    }
    return result
  },

  getTotalStats: () => {
    const { transactions } = get()
    const income = transactions.filter(t => t.type === 'Income').reduce((sum, t) => sum + (t.amount || 0), 0)
    const expenses = transactions.filter(t => t.type === 'Expense').reduce((sum, t) => sum + (t.amount || 0), 0)
    return { income, expenses, profit: income - expenses }
  },
}))
