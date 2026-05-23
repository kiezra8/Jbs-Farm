import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, X } from 'lucide-react'

export default function ConfirmDialog({ isOpen, onClose, onConfirm, title, message, confirmLabel = 'Delete', danger = true }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ background: 'rgba(2,6,23,0.9)', backdropFilter: 'blur(8px)' }}
        >
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.85, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 400 }}
            className="glass-card w-full max-w-sm p-6 text-center"
          >
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4
              ${danger ? 'bg-red-500/15 border border-red-500/25' : 'bg-amber-500/15 border border-amber-500/25'}`}>
              <AlertTriangle size={26} className={danger ? 'text-red-400' : 'text-amber-400'} />
            </div>
            <h3 className="font-display font-semibold text-lg text-white mb-2">{title}</h3>
            <p className="text-sm text-slate-400 mb-6">{message}</p>
            <div className="flex gap-3">
              <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
              <button onClick={() => { onConfirm(); onClose() }}
                className={`flex-1 py-2 px-4 rounded-xl font-medium text-sm transition-all duration-200 flex items-center justify-center
                  ${danger ? 'btn-danger' : 'btn-primary'}`}>
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
