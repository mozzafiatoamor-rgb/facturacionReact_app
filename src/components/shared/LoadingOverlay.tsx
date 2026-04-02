// ── LoadingOverlay — Logo + spinner + mensajes motivacionales
// Delay de 150ms para evitar flicker en cargas rápidas

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useGlobalFetching } from '../../hooks/useSheets'
import { LOADING_MESSAGES } from '../../api/config'

const LOGO = '/logo.png'

export function LoadingOverlay() {
  const isFetching = useGlobalFetching()
  const [visible, setVisible] = useState(false)
  const [msgIndex, setMsgIndex] = useState(0)

  // Delay de 150ms para evitar flicker
  useEffect(() => {
    if (isFetching) {
      const t = setTimeout(() => setVisible(true), 150)
      return () => clearTimeout(t)
    } else {
      setVisible(false)
    }
  }, [isFetching])

  // Rotar mensajes cada 2 s
  useEffect(() => {
    if (!visible) return
    const t = setInterval(() => {
      setMsgIndex((i) => (i + 1) % LOADING_MESSAGES.length)
    }, 2000)
    return () => clearInterval(t)
  }, [visible])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-4"
        >
          <img
            src={LOGO}
            alt="Logo"
            className="h-14 w-auto object-contain"
            onError={(e) => {
              const el = e.currentTarget as HTMLImageElement
              el.outerHTML = '<span class="text-5xl">🧾</span>'
            }}
          />
          <div className="w-10 h-10 border-3 border-white/20 border-t-accent rounded-full animate-spin" />
          <motion.p
            key={msgIndex}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-sm text-muted"
          >
            {LOADING_MESSAGES[msgIndex]}
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
