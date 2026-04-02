// ============================================================
// MESEROPAGA.TSX — Paso 1: Mesa, monto, tipo de pago, notas
// Step indicator animado · inputs numéricos con inputMode
// ============================================================

import { useState } from 'react'
import { motion } from 'framer-motion'
import { StatusBar } from '../components/layout/StatusBar'
import { useToast } from '../hooks/useToast'
import { TIPOS_PAGO } from '../api/config'
import type { CurrentOrder } from '../api/types'

const STEPS = ['Mesa', 'Cliente', 'Confirmar', 'Listo']

interface MeseroPageProps {
  initial?:    Partial<CurrentOrder>
  onNext:      (order: CurrentOrder) => void
  onBack:      () => void
  userName:    string
}

export function MeseroPage({ initial, onNext, onBack, userName }: MeseroPageProps) {
  const { toast } = useToast()
  const [mesa,     setMesa    ] = useState(initial?.mesa     ?? '')
  const [monto,    setMonto   ] = useState(initial?.monto    ?? '')
  const [tipoPago, setTipoPago] = useState(initial?.tipoPago ?? '')
  const [notas,    setNotas   ] = useState(initial?.notas    ?? '')

  function handleContinuar() {
    if (!mesa.trim()) { toast('Ingresa el número de mesa', 'error');   return }
    if (!monto || parseFloat(monto) <= 0) { toast('Monto inválido', 'error'); return }
    if (!tipoPago) { toast('Selecciona el tipo de pago', 'error'); return }

    onNext({ mesa: mesa.trim(), monto, tipoPago, notas: notas.trim(), mesero: userName })
  }

  return (
    <div className="min-h-dvh bg-bg flex flex-col">
      <StatusBar title="🍽️ Nueva Solicitud" subtitle={userName} onBack={onBack} />

      <div className="flex-1 px-4 pt-5 pb-8 max-w-sm mx-auto w-full">
        {/* Step indicator */}
        <StepIndicator current={0} steps={STEPS} />

        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25 }}
          className="text-center mb-5"
        >
          <h2 className="text-xl font-bold text-white">Datos de la Mesa</h2>
          <p className="text-sm text-muted mt-1">Ingresa la información de la orden</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="bg-surface border border-white/10 rounded-xl p-5"
        >
          {/* Mesa + Monto */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs text-muted font-medium mb-1.5">Mesa</label>
              <input
                value={mesa}
                onChange={(e) => setMesa(e.target.value)}
                type="text"
                inputMode="numeric"
                placeholder="Ej: 5"
                className="input text-center text-lg font-bold"
                autoComplete="off"
              />
            </div>
            <div>
              <label className="block text-xs text-muted font-medium mb-1.5">Monto a Facturar</label>
              <input
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                type="number"
                inputMode="decimal"
                placeholder="0.00"
                step="0.01"
                className="input"
                autoComplete="off"
              />
            </div>
          </div>

          {/* Tipo de pago */}
          <div className="mb-4">
            <label className="block text-xs text-muted font-medium mb-2">Tipo de Pago</label>
            <div className="grid grid-cols-2 gap-2">
              {TIPOS_PAGO.map((tp) => (
                <motion.button
                  key={tp.clave}
                  type="button"
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setTipoPago(tp.clave)}
                  className={`rounded-xl py-3 px-2 text-center border-2 font-semibold text-sm transition-colors ${
                    tipoPago === tp.clave
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-white/10 bg-surface2 text-white'
                  }`}
                >
                  <span className="block text-2xl mb-1">{tp.icon}</span>
                  {tp.label}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Notas */}
          <div className="mb-5">
            <label className="block text-xs text-muted font-medium mb-1.5">Notas (opcional)</label>
            <input
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Ej: propina incluida, cliente pidió factura global..."
              className="input"
              autoComplete="off"
            />
          </div>

          <button onClick={handleContinuar} className="btn btn-primary w-full text-base">
            Pasar a Cliente →
          </button>
        </motion.div>
      </div>
    </div>
  )
}

// ── Step Indicator ─────────────────────────────────────────
export function StepIndicator({ current, steps }: { current: number; steps: string[] }) {
  return (
    <div className="flex items-center justify-center gap-2 py-3 mb-3">
      {steps.map((_, i) => (
        <motion.div
          key={i}
          animate={{
            width:      i === current ? 24 : 8,
            background: i < current ? '#34d399' : i === current ? '#3b82f6' : 'rgba(255,255,255,0.15)',
          }}
          className="h-2 rounded-full"
          transition={{ duration: 0.3 }}
        />
      ))}
    </div>
  )
}
