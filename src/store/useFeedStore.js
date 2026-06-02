import { create } from 'zustand'
import { db } from '../db/schema'

export const useFeedStore = create((set, get) => ({
  inventory: [],
  transactions: [],
  loading: false,

  loadAll: async () => {
    set({ loading: true })
    let inventory = await db.feedInventory.toArray()
    
    // Ensure requested feed types exist for existing users
    const defaultFeeds = [
      { feedType: 'Hay', unit: 'bales', currentStock: 0, minStock: 50, unitCost: 12000 },
      { feedType: 'Silage', unit: 'kg', currentStock: 0, minStock: 1000, unitCost: 800 },
      { feedType: 'Pasture', unit: 'acres', currentStock: 0, minStock: 30, unitCost: 20000 },
      { feedType: 'Maize Bran', unit: 'kg', currentStock: 0, minStock: 500, unitCost: 1200 },
      { feedType: 'Broken Maize', unit: 'kg', currentStock: 0, minStock: 500, unitCost: 1500 },
      { feedType: 'Sunflower Cake', unit: 'kg', currentStock: 0, minStock: 300, unitCost: 2000 },
      { feedType: 'Cotton Cake', unit: 'kg', currentStock: 0, minStock: 300, unitCost: 2200 },
      { feedType: 'Premix', unit: 'kg', currentStock: 0, minStock: 100, unitCost: 8000 },
      { feedType: 'Calcium', unit: 'kg', currentStock: 0, minStock: 100, unitCost: 3000 },
      { feedType: 'Blown Salt', unit: 'kg', currentStock: 0, minStock: 50, unitCost: 1800 },
      { feedType: 'White Salt', unit: 'kg', currentStock: 0, minStock: 50, unitCost: 1500 },
      { feedType: 'Mineral Blocks', unit: 'blocks', currentStock: 0, minStock: 10, unitCost: 25000 },
      { feedType: 'Kikanja', unit: 'kg', currentStock: 0, minStock: 200, unitCost: 900 },
    ]
    
    let needsReload = false
    for (const df of defaultFeeds) {
      if (!inventory.some(i => i.feedType === df.feedType)) {
        await db.feedInventory.add({ ...df, updatedAt: new Date().toISOString() })
        needsReload = true
      }
    }
    if (needsReload) {
      inventory = await db.feedInventory.toArray()
    }

    const transactions = await db.feedTransactions.orderBy('date').reverse().toArray()
    set({ inventory, transactions, loading: false })
  },

  updateInventory: async (id, data) => {
    await db.feedInventory.update(id, { ...data, updatedAt: new Date().toISOString() })
    const item = await db.feedInventory.get(id)
    set(s => ({ inventory: s.inventory.map(i => i.id === id ? item : i) }))
  },

  addInventoryItem: async (data) => {
    const now = new Date().toISOString()
    const id = await db.feedInventory.add({ ...data, updatedAt: now })
    const item = await db.feedInventory.get(id)
    set(s => ({ inventory: [...s.inventory, item] }))
    return item
  },

  addTransaction: async (data) => {
    const now = new Date().toISOString()
    const id = crypto.randomUUID()
    await db.feedTransactions.add({ ...data, id, createdAt: now })
    const tx = await db.feedTransactions.get(id)
    set(s => ({ transactions: [tx, ...s.transactions] }))
    // update inventory stock
    const invItem = get().inventory.find(i => i.feedType === data.feedType)
    if (invItem) {
      const newQty = data.type === 'Purchase'
        ? invItem.currentStock + data.quantity
        : Math.max(0, invItem.currentStock - data.quantity)
      await get().updateInventory(invItem.id, { currentStock: newQty })
    }
    return tx
  },

  getLowStockItems: () => get().inventory.filter(i => i.currentStock <= i.minStock),

  getStats: () => {
    const { inventory, transactions } = get()
    const totalValue = inventory.reduce((sum, i) => sum + (i.currentStock * i.unitCost), 0)
    const monthPurchases = transactions
      .filter(t => t.type === 'Purchase')
      .reduce((sum, t) => sum + (t.totalCost || 0), 0)
    return { totalValue, monthPurchases, lowStockCount: inventory.filter(i => i.currentStock <= i.minStock).length }
  },
}))
