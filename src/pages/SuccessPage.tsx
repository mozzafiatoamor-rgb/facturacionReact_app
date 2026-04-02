// ============================================================
// SUCCESSPAGE.TSX — Paso 4: Confirmación visual con animación
// ============================================================

import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { fmt$ } from '../utils/dates'
import type { CurrentOrder } from '../api/types'
import type { ClienteFormData } from '../components/forms/ClienteForm'

interface SuccessPageProps {
  order:      CurrentOrder
  cliente:    ClienteFormData
  onNueva:   () => void
  onHome:    () => void
}

export function SuccessPage({ order, cliente, onNueva, onHome }: SuccessPageProps) {
  // Vibración de éxito en Android
  useEffect(() => {
    try { navigator.vibrate?.([50, 30, 80]) } catch { /* ignore */ }
  }, [])

  return (
    <div className="min-h-dvh bg-bg flex flex-col items-center justify-center px-6 text-center">
      {/* Checkmark animado */}
      <motion.div
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', damping: 16, stiffness: 200 }}
        className="text-8xl mb-4"
      >
        ✅
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <h1 className="text-2xl font-bold text-success mb-2">
          ¡Solicitud Enviada!
        </h1>
        <p className="text-muted text-sm mb-1">
          Mesa {order.mesa} · {fmt$(order.monto)}
        </p>
        <p className="text-muted text-sm mb-6">
          {cliente.rfc} — {cliente.razonSocial}
        </p>

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
