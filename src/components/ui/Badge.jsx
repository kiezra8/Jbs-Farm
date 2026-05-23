// Badge component
export function Badge({ children, variant = 'gray' }) {
  const variants = {
    green:  'badge-green',
    red:    'badge-red',
    amber:  'badge-amber',
    blue:   'badge-blue',
    purple: 'badge-purple',
    gray:   'badge-gray',
  }
  return <span className={variants[variant] || variants.gray}>{children}</span>
}

// Status badge for animal health
export function StatusBadge({ status }) {
  const map = {
    'Healthy':  { variant: 'green',  label: 'Healthy' },
    'Sick':     { variant: 'red',    label: 'Sick' },
    'Pregnant': { variant: 'purple', label: 'Pregnant' },
    'Calf':     { variant: 'blue',   label: 'Calf' },
    'Dry':      { variant: 'amber',  label: 'Dry' },
    'Sold':     { variant: 'gray',   label: 'Sold' },
    'Deceased': { variant: 'gray',   label: 'Deceased' },
    'Active':   { variant: 'green',  label: 'Active' },
    'Inactive': { variant: 'gray',   label: 'Inactive' },
  }
  const cfg = map[status] || { variant: 'gray', label: status }
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>
}

// Health type badge
export function HealthBadge({ type }) {
  const map = {
    'Vaccination': { variant: 'blue',   label: '💉 Vaccination' },
    'Treatment':   { variant: 'red',    label: '🏥 Treatment' },
    'Deworming':   { variant: 'amber',  label: '🔬 Deworming' },
    'Vet Visit':   { variant: 'purple', label: '👨‍⚕️ Vet Visit' },
    'Mortality':   { variant: 'gray',   label: '💀 Mortality' },
  }
  const cfg = map[type] || { variant: 'gray', label: type }
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>
}

// Priority badge
export function PriorityBadge({ priority }) {
  const map = {
    'High':   { variant: 'red',   label: '🔴 High' },
    'Medium': { variant: 'amber', label: '🟡 Medium' },
    'Low':    { variant: 'green', label: '🟢 Low' },
  }
  const cfg = map[priority] || { variant: 'gray', label: priority }
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>
}
