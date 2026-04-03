// ============================================================
// SUCCESSPAGE.TSX — Paso 4: Confirmación visual con logo,
// frase motivacional aleatoria y animaciones
// ============================================================

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { fmt$ } from '../utils/dates'
import { LOGO } from '../assets/logo'
import type { CurrentOrder } from '../api/types'
import type { ClienteFormData } from '../components/forms/ClienteForm'

const SUCCESS_MESSAGES = [
  '¡Solicitud enviada con éxito! Tu factura está en camino.',
  '¡Excelente! Pronto recibirás tu factura por correo.',
  '¡Listo! Tu solicitud fue registrada correctamente.',
  '¡Perfecto! El equipo contable ya tiene tu solicitud.',
  '¡Genial! Tu factura será procesada a la brevedad.',
  '¡Todo en orden! Revisa tu correo para la confirmación.',
  '¡Hecho! Gracias por tu preferencia en Mozzafiato.',
  '¡Solicitud registrada! Nos encanta atenderte.',
  '¡Enviado! Tu factura estará lista muy pronto.',
  '¡Gracias! Tu experiencia Mozzafiato está completa.',
  '¡Tu factura va volando! Gracias por elegirnos.',
  '¡Misión cumplida! Tu factura llegará pronto a tu correo.',
  '¡Así de fácil! Disfruta mientras preparamos tu factura.',
  '¡Increíble experiencia! Tu factura está en proceso.',
  '¡Eso fue rápido! Tu solicitud ya está siendo atendida.',
]

interface SuccessPageProps {
  order:      CurrentOrder
  cliente:    ClienteFormData
  onNueva:   () => void
  onHome:    () => void
}

export function SuccessPage({ order, cliente, onNueva, onHome }: SuccessPageProps) {
  const [msgIndex, setMsgIndex] = useState(() => Math.floor(Math.random() * SUCCESS_MESSAGES.length))

  // Vibración de éxito en Android
  useEffect(() => {
    try { navigator.vibrate?.([50, 30, 80]) } catch { /* ignore */ }
  }, [])

  // Rotar mensajes cada 3s para mantener al cliente entretenido
  useEffect(() => {
    const t = setInterval(() => {
      setMsgIndex(() => Math.floor(Math.random() * SUCCESS_MESSAGES.length))
    }, 3000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="h-full bg-bg flex flex-col items-center justify-center px-6 text-center overflow-hidden relative">
      {/* Partículas decorativas de fondo */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 rounded-full bg-accent/20"
          initial={{ opacity: 0, y: 100, x: (i - 3) * 60 }}
          animate={{
            opacity: [0, 0.6, 0],
            y: [100, -200],
            x: (i - 3) * 60 + Math.sin(i) * 30,
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            delay: i * 0.5,
            ease: 'easeOut',
          }}
        />
      ))}

      {/* Logo animado */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 16, stiffness: 200 }}
        className="mb-4"
      >
        <img src={LOGO} alt="Logo" className="h-24 w-auto object-contain drop-shadow-xl mx-auto" />
      </motion.div>

      {/* Checkmark animado */}
      <motion.div
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', damping: 16, stiffness: 200, delay: 0.15 }}
        className="text-6xl mb-4"
      >
        ✅
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        {/* Frase motivacional aleatoria — rota cada 3s */}
        <AnimatePresence mode="wait">
          <motion.p
            key={msgIndex}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35 }}
            className="text-lg font-bold text-success mb-4 leading-snug max-w-[280px] mx-auto"
          >
            {SUCCESS_MESSAGES[msgIndex]}
          </motion.p>
        </AnimatePresence>

        <div className="bg-surface/60 border border-white/10 rounded-xl px-4 py-3 mb-6 backdrop-blur-sm">
          <p className="text-white text-sm font-medium mb-1">
            Mesa {order.mesa} · {fmt$(order.monto)}
          </p>
          <p className="text-muted text-xs">
            {cliente.rfc} — {cliente.razonSocial}
          </p>
        </div>

        <div className="flex flex-col gap-3 w-full max-w-xs mx-auto">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onNueva}
            className="btn btn-primary w-full text-base"
          >
            + Nueva Solicitud
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onHome}
            className="btn w-full bg-surface border border-white/10 text-white"
          >
            Ir al Inicio
          </motion.button>
        </div>
      </motion.div>
    </div>
  )
}
