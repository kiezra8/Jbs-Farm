// Format currency in UGX
export const formatUGX = (amount) => {
  if (amount === null || amount === undefined) return 'Ushs 0'
  return `Ushs ${Number(amount).toLocaleString('en-UG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

// Format liters
export const formatLiters = (val) => `${Number(val || 0).toFixed(1)} L`

// Format weight
export const formatWeight = (val) => `${Number(val || 0).toFixed(0)} kg`

// Format age in months to readable string
export const formatAge = (months) => {
  if (!months) return '—'
  if (months < 12) return `${months}mo`
  const yrs = Math.floor(months / 12)
  const mo = months % 12
  return mo > 0 ? `${yrs}yr ${mo}mo` : `${yrs}yr`
}

// Days until a future date
export const daysUntil = (dateStr) => {
  if (!dateStr) return null
  const diff = Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24))
  return diff
}

// Days since a past date
export const daysSince = (dateStr) => {
  if (!dateStr) return null
  return Math.floor((new Date() - new Date(dateStr)) / (1000 * 60 * 60 * 24))
}

// Truncate long strings
export const truncate = (str, len = 40) => {
  if (!str) return ''
  return str.length > len ? str.slice(0, len) + '…' : str
}

// Color for percentage fill
export const stockColor = (pct) => {
  if (pct > 60) return '#22c55e'
  if (pct > 30) return '#f59e0b'
  return '#ef4444'
}

// Generate tag avatar color from tag string
export const tagColor = (tag = '') => {
  const colors = ['#22c55e', '#3b82f6', '#a855f7', '#f59e0b', '#ef4444', '#06b6d4']
  const idx = tag.charCodeAt(tag.length - 1) % colors.length
  return colors[idx]
}
