// ============================================================
// LOADINGOVERLAY.TSX — Logo + frases motivacionales + puntos animados
// Delay 150ms para evitar flicker en cargas rápidas
// ============================================================

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useGlobalFetching } from '../../hooks/useSheets'
import { LOADING_MESSAGES } from '../../api/config'

const B = import.meta.env.BASE_URL
const LOGO = `${B}logo.png`
const LOGO_FB = `${B}icon-192.png`

export function LoadingOverlay() {
  const isFetching = useGlobalFetching()
  const [visible,  setVisible ] = useState(false)
  const [msgIndex, setMsgIndex] = useState(0)
  const [logoErr,  setLogoErr ] = useState(false)

  // Delay 150ms para evitar flicker en cargas muy rápidas
  useEffect(() => {
    if (isFetching) {
      const t = setTimeout(() => setVisible(true), 150)
      return () => clearTimeout(t)
    } else {
      setVisible(false)
    }
  }, [isFetching])

  // Rotar mensajes cada 2.2 s
  useEffect(() => {
    if (!visible) return
    setMsgIndex(Math.floor(Math.random() * LOADING_MESSAGES.length))
    const t = setInterval(() => {
      setMsgIndex(() => Math.floor(Math.random() * LOADING_MESSAGES.length))
    }, 2200)
    return () => clearInterval(t)
  }, [visible])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="loading-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5"
          style={{ background: 'rgba(14, 23, 38, 0.92)', backdropFilter: 'blur(6px)' }}
        >
          {/* Logo */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1,   opacity: 1 }}
            transition={{ type: 'spring', damping: 18, stiffness: 200 }}
          >
            {!logoErr ? (
              <img
                src={LOGO}
                alt="Logo"
                className="h-20 w-auto object-contain drop-shadow-xl"
                onError={(e) => {
                  const el = e.currentTarget
                  if (el.getAttribute('src') !== LOGO_FB) {
                    el.setAttribute('src', LOGO_FB)
                  } else {
                    setLogoErr(true)
                  }
                }}
              />
            ) : (
              <span className="text-6xl">🧾</span>
            )}
          </motion.div>

          {/* Puntos de carga animados */}
          <div className="flex gap-2">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2 h-2 rounded-full bg-accent"
                animate={{ y: [0, -8, 0], opacity: [0.4, 1, 0.4] }}
                transition={{
                  duration: 0.9,
                  repeat: Infinity,
                  delay: i * 0.18,
                  ease: 'easeInOut',
                }}
              />
            ))}
          </div>

          {/* Frase motivacional */}
          <AnimatePresence mode="wait">
            <motion.p
              key={msgIndex}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{    opacity: 0, y: -8 }}
              transition={{ duration: 0.35 }}
              className="text-sm text-muted text-center max-w-[220px] leading-relaxed"
            >
              {LOADING_MESSAGES[msgIndex]}
            </motion.p>
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
