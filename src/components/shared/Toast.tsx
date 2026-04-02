// ── Toast — Sistema propio, 3 tipos, AnimatePresence

import { AnimatePresence, motion } from 'framer-motion'
import type { ToastMessage } from '../../api/types'

const TYPE_STYLES: Record<ToastMessage['type'], string> = {
  success: 'border-success/40 text-success',
  error:   'border-danger/40  text-danger',
  info:    'border-info/40    text-info',
}

interface ToastContainerProps {
  toasts:  ToastMessage[]
  dismiss: (id: number) => void
}

export function ToastContainer({ toasts, dismiss }: ToastContainerProps) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.button
            key={t.id}
            initial={{ opacity: 0, y: 40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0,  scale: 1   }}
            exit={{    opacity: 0, y: 40, scale: 0.9 }}
            transition={{ type: 'spring', damping: 24, stiffness: 300 }}
            onClick={() => dismiss(t.id)}
            className={`
              pointer-events-auto
              bg-surface2 border rounded-xl
              px-5 py-3 text-sm font-medium
              shadow-xl whitespace-nowrap max-w-[90vw]
              text-left
              ${TYPE_STYLES[t.type]}
            `}
          >
            {t.message}
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  )
}
