import { useState } from 'react'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Lock, Beef } from 'lucide-react'
import { useAuthStore } from '../../store/useAuthStore'
import { useNavigate } from 'react-router-dom'

export default function Login() {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [showPin, setShowPin] = useState(false)
  const { login } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = (e) => {
    e.preventDefault()
    if (login(pin)) {
      navigate('/dashboard')
    } else {
      setError('Incorrect PIN. Please try again.')
      setPin('')
      setTimeout(() => setError(''), 3000)
    }
  }

  const handlePadPress = (val) => {
    if (val === 'del') { setPin(p => p.slice(0, -1)); return }
    if (pin.length < 6) setPin(p => p + val)
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at 20% 50%, rgba(34,197,94,0.08) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(59,130,246,0.06) 0%, transparent 50%), #020617' }}>

      {/* Background grid */}
      <div className="absolute inset-0 opacity-5"
        style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

      {/* Floating orbs */}
      <div className="absolute top-20 left-20 w-64 h-64 rounded-full opacity-10 animate-pulse"
        style={{ background: 'radial-gradient(circle, #22c55e, transparent 70%)' }} />
      <div className="absolute bottom-20 right-20 w-48 h-48 rounded-full opacity-8 animate-pulse"
        style={{ background: 'radial-gradient(circle, #3b82f6, transparent 70%)', animationDelay: '1s' }} />

      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-sm mx-4"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }} animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', boxShadow: '0 0 40px rgba(34,197,94,0.4)' }}
          >
            <Beef size={38} className="text-white" />
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="font-display font-bold text-3xl text-white mb-1"
          >
            JBS Farm
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
            className="text-slate-400 text-sm"
          >
            Smart Farm Management System
          </motion.p>
        </div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="glass-card p-8"
        >
          <div className="flex items-center gap-2 mb-6">
            <Lock size={16} className="text-green-400" />
            <span className="text-sm font-medium text-slate-300">Enter your PIN to access</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* PIN Input */}
            <div className="relative">
              <div className="flex justify-center gap-3 mb-4">
                {Array.from({ length: Math.max(4, pin.length + 1 <= 6 ? pin.length + 1 : 6) }, (_, i) => (
                  <div key={i}
                    className={`w-3 h-3 rounded-full transition-all duration-200 ${i < pin.length ? 'scale-125' : 'scale-100'}`}
                    style={{ background: i < pin.length ? '#22c55e' : 'rgba(255,255,255,0.15)', boxShadow: i < pin.length ? '0 0 8px rgba(34,197,94,0.6)' : 'none' }}
                  />
                ))}
              </div>
              <div className="relative">
                <input
                  type={showPin ? 'text' : 'password'}
                  value={pin}
                  onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Enter PIN"
                  className="input-field text-center text-lg tracking-widest pr-10"
                  autoFocus
                />
                <button type="button" onClick={() => setShowPin(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors">
                  {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Number Pad */}
            <div className="grid grid-cols-3 gap-2">
              {['1','2','3','4','5','6','7','8','9','','0','del'].map((k) => (
                <button
                  key={k} type="button"
                  onClick={() => k && handlePadPress(k)}
                  disabled={!k}
                  className={`py-3 rounded-xl font-display font-semibold text-lg transition-all duration-150 active:scale-95
                    ${!k ? 'invisible' : k === 'del'
                      ? 'bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 text-sm'
                      : 'hover:bg-white/10 active:bg-white/15 border border-white/05 text-white'}`}
                  style={{ background: k && k !== 'del' ? 'rgba(255,255,255,0.05)' : undefined }}
                >
                  {k === 'del' ? '⌫' : k}
                </button>
              ))}
            </div>

            {/* Error */}
            {error && (
              <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
                className="text-red-400 text-sm text-center">{error}</motion.p>
            )}

            <button type="submit" disabled={pin.length < 4}
              className="btn-primary w-full justify-center py-3 text-base disabled:opacity-40 disabled:cursor-not-allowed">
              Unlock System
            </button>
          </form>

          <p className="text-center text-xs text-slate-600 mt-4">
            Default PIN: <span className="text-slate-400 font-mono">1234</span>
          </p>
        </motion.div>

        <p className="text-center text-xs text-slate-600 mt-6">
          JBS Farm Management System v1.0 · Offline-First
        </p>
      </motion.div>
    </div>
  )
}
