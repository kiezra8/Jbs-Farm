import { useState } from 'react'
import { Lock } from 'lucide-react'

export default function PinGuard({ children }) {
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (pin === '88888888') {
      setIsUnlocked(true)
    } else {
      setError('Incorrect PIN')
      setPin('')
    }
  }

  if (isUnlocked) return children

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <div className="glass-card p-8 max-w-sm w-full text-center">
        <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
          <Lock size={32} />
        </div>
        <h2 className="text-xl font-display font-semibold text-white mb-2">Restricted Access</h2>
        <p className="text-sm text-slate-400 mb-6">Enter PIN to access this section</p>
        
        <form onSubmit={handleSubmit}>
          <input 
            type="password" 
            className="input-field text-center tracking-[0.5em] text-lg mb-4" 
            placeholder="••••••••"
            value={pin}
            onChange={e => {setPin(e.target.value); setError('')}}
            autoFocus
          />
          {error && <p className="text-red-400 text-xs mb-4">{error}</p>}
          <button type="submit" className="btn-primary w-full justify-center">Unlock</button>
        </form>
      </div>
    </div>
  )
}
