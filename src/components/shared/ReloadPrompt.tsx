// ============================================================
// RELOADPROMPT.TSX — Banner de "nueva versión disponible"
// Aparece automáticamente cuando hay un Service Worker nuevo
// El usuario toca "Actualizar" para cargar la versión más reciente
// ============================================================

import { useRegisterSW } from 'virtual:pwa-register/react'
import { motion, AnimatePresence } from 'framer-motion'

export function ReloadPrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Revisa cada 60s si hay nueva versión
      if (registration) {
        setInterval(() => registration.update(), 60_000)
      }
    },
  })

  return (
    <AnimatePresence>
      {needRefresh && (
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 60 }}
          className="fixed bottom-4 left-4 right-4 z-[9999] flex items-center gap-3 bg-accent/95 backdrop-blur-md text-white rounded-2xl px-4 py-3 shadow-lg shadow-accent/30 max-w-md mx-auto"
        >
          <span className="text-xl flex-shrink-0">🔄</span>
          <p className="text-sm font-medium flex-1">
            Nueva versión disponible
          </p>
          <button
            onClick={() => updateServiceWorker(true)}
            className="flex-shrink-0 bg-white text-accent font-bold text-xs px-4 py-2 rounded-xl hover:bg-white/90 transition-colors"
          >
            Actualizar
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
