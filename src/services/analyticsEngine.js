import { format, subDays } from 'date-fns'
import { db } from '../db/schema'

export async function generateInsights() {
  const insights = []

  try {
    // Milk production drop
    const milkRecords = await db.milkRecords.toArray()
    const today = format(new Date(), 'yyyy-MM-dd')
    const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd')
    const last7 = Array.from({ length: 7 }, (_, i) => format(subDays(new Date(), i + 1), 'yyyy-MM-dd'))
    const prev7 = Array.from({ length: 7 }, (_, i) => format(subDays(new Date(), i + 8), 'yyyy-MM-dd'))

    const current7Total = milkRecords.filter(r => last7.includes(r.date)).reduce((s, r) => s + r.amount, 0)
    const prev7Total = milkRecords.filter(r => prev7.includes(r.date)).reduce((s, r) => s + r.amount, 0)
    if (prev7Total > 0) {
      const pct = ((current7Total - prev7Total) / prev7Total * 100).toFixed(1)
      if (Math.abs(pct) > 3) {
        insights.push({
          type: pct < 0 ? 'warning' : 'success',
          icon: pct < 0 ? '📉' : '📈',
          text: `Milk production ${pct < 0 ? 'dropped' : 'increased'} ${Math.abs(pct)}% this week (${current7Total.toFixed(0)}L vs ${prev7Total.toFixed(0)}L last week).`,
        })
      }
    }

    // Sick animals
    const animals = await db.animals.toArray()
    const sickCount = animals.filter(a => a.status === 'Sick').length
    if (sickCount > 0) {
      insights.push({ type: 'danger', icon: '🏥', text: `${sickCount} animal${sickCount > 1 ? 's are' : ' is'} currently marked as sick and require attention.` })
    }

    // Upcoming calvings
    const breeding = await db.breedingRecords.toArray()
    const upcomingCalvings = breeding.filter(b => {
      if (b.status !== 'Confirmed Pregnant' || !b.expectedCalving) return false
      const days = Math.ceil((new Date(b.expectedCalving) - new Date()) / (1000 * 60 * 60 * 24))
      return days >= 0 && days <= 14
    })
    if (upcomingCalvings.length > 0) {
      insights.push({ type: 'info', icon: '🐄', text: `${upcomingCalvings.length} cow${upcomingCalvings.length > 1 ? 's are' : ' is'} expected to calve within the next 14 days.` })
    }

    // Low feed stock
    const feedInventory = await db.feedInventory.toArray()
    const lowStock = feedInventory.filter(f => f.currentStock <= f.minStock)
    if (lowStock.length > 0) {
      insights.push({ type: 'warning', icon: '⚠️', text: `${lowStock.map(f => f.feedType).join(', ')} ${lowStock.length > 1 ? 'are' : 'is'} running low on stock.` })
    }

    // Vaccination compliance
    const health = await db.healthRecords.toArray()
    const vaccs = health.filter(h => h.type === 'Vaccination')
    const compliance = animals.length > 0 ? Math.round((vaccs.length / (animals.length * 2)) * 100) : 0
    if (compliance > 0) {
      insights.push({ type: 'success', icon: '💉', text: `Vaccination compliance stands at ${Math.min(compliance, 100)}% across the herd.` })
    }

    // Today's milk estimate
    const todayMilk = milkRecords.filter(r => r.date === today).reduce((s, r) => s + r.amount, 0)
    if (todayMilk > 0) {
      insights.push({ type: 'info', icon: '🥛', text: `Today's milk production so far: ${todayMilk.toFixed(1)} litres.` })
    }

    // Finance - this month
    const finances = await db.finances.toArray()
    const thisMonth = format(new Date(), 'yyyy-MM')
    const monthlyExpenses = finances.filter(f => f.type === 'Expense' && f.date?.startsWith(thisMonth)).reduce((s, f) => s + f.amount, 0)
    const prevMonth = format(subDays(new Date(), 30), 'yyyy-MM')
    const prevExpenses = finances.filter(f => f.type === 'Expense' && f.date?.startsWith(prevMonth)).reduce((s, f) => s + f.amount, 0)
    if (prevExpenses > 0 && monthlyExpenses > prevExpenses * 1.1) {
      insights.push({ type: 'warning', icon: '💰', text: `Feed and operational costs increased this month. Monitor expenses closely.` })
    }

    // Pregnant cows count
    const pregnantCount = breeding.filter(b => b.status === 'Confirmed Pregnant').length
    if (pregnantCount > 0) {
      insights.push({ type: 'info', icon: '🤰', text: `${pregnantCount} cow${pregnantCount > 1 ? 's are' : ' is'} currently confirmed pregnant.` })
    }

  } catch (e) {
    console.error('Analytics error:', e)
  }

  return insights.slice(0, 6)
}

export async function getMilkLeaderboard(animals, milkRecords) {
  const perCow = {}
  milkRecords.forEach(r => {
    perCow[r.animalId] = (perCow[r.animalId] || 0) + r.amount
  })
  return Object.entries(perCow)
    .map(([id, total]) => {
      const animal = animals.find(a => a.id === Number(id))
      return { animal, total }
    })
    .filter(e => e.animal)
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)
}
