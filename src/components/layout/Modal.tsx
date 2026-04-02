// ── Modal — AnimatePresence + backdrop blur + slide up

import { motion, AnimatePresence } from 'framer-motion'
import type { ReactNode } from 'react'

interface ModalProps {
  open:     boolean
  onClose?: () => void
  title?:   string
  children: ReactNode
  /** Ancho máximo, por defecto max-w-sm */
  maxWidth?: string
}

export function Modal({ open, onClose, title, children, maxWidth = 'max-w-sm' }: ModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 60 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className={`
              fixed bottom-0 left-0 right-0 z-50
              mx-auto ${maxWidth} w-full
              bg-surface border border-white/10 rounded-t-2xl
              p-5 max-h-[90dvh] overflow-y-auto
            `}
          >
            {title && (
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-white">{title}</h2>
                {onClose && (
                  <button
                    onClick={onClose}
                    className="w-8 h-8 rounded-lg bg-surface2 text-muted flex items-center justify-center text-lg"
                    aria-label="Cerrar"
                  >
                    ×
                  </button>
                )}
              </div>
            )}
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
