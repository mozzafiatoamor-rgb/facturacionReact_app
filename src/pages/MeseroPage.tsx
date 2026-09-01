// ============================================================
// MESEROPAGA.TSX — Paso 1: Negocio + Mesa, monto, tipo de pago, notas
// Step indicator animado · inputs numéricos con inputMode
// Botón "Enviar link para llevar" → genera link WhatsApp
// ============================================================

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { StatusBar } from '../components/layout/StatusBar'
import { useToast } from '../hooks/useToast'
import { TIPOS_PAGO } from '../api/config'
import { buildLlevarUrl, buildWhatsAppUrl } from '../utils/llevar'
import { now } from '../utils/dates'
import { NEGOCIO_LIST, getNegocio } from '../config/businesses'
import { getLogo } from '../assets/logos'
import type { CurrentOrder } from '../api/types'

const STEPS = ['Negocio', 'Datos', 'Enviar']

interface MeseroPageProps {
  initial?:    Partial<CurrentOrder>
  onGenerarFactura: (order: CurrentOrder) => void
  onBack:      () => void
  userName:    string
}

export function MeseroPage({ initial, onGenerarFactura, onBack, userName }: MeseroPageProps) {
  const { toast } = useToast()
  const [negocio,  setNegocio ] = useState(initial?.negocio  ?? '')
  const [mesa,     setMesa    ] = useState(initial?.mesa     ?? '')
  const [monto,    setMonto   ] = useState(initial?.monto    ?? '')
  const [tipoPago, setTipoPago] = useState(initial?.tipoPago ?? '')
  const [notas,    setNotas   ] = useState(initial?.notas    ?? '')
  const [whatsapp, setWhatsapp] = useState('')

  function validate(): boolean {
    if (!negocio) { toast('Selecciona el negocio', 'error'); return false }
    if (!mesa.trim()) { toast('Ingresa el número de mesa / habitación', 'error'); return false }
    if (!monto || parseFloat(monto) <= 0) { toast('Monto inválido', 'error'); return false }
    if (!tipoPago) { toast('Selecciona el tipo de pago', 'error'); return false }
    return true
  }

  function handleEnviarWhatsApp() {
    if (!validate()) return
    const num = whatsapp.replace(/\D/g, '')
    if (num.length < 10) {
      toast('Ingresa un número válido de 10 dígitos', 'error')
      return
    }
    const { date, time } = now()
    const url = buildLlevarUrl({
      mesa: mesa.trim(),
      monto,
      tipoPago,
      mesero: userName,
      fecha: date,
      hora: time,
      negocio,
    })
    const neg = getNegocio(negocio)
    const waUrl = buildWhatsAppUrl(num, url, monto, neg.name)
    window.open(waUrl, '_blank')
    toast('Link enviado por WhatsApp')
    setTimeout(() => onBack(), 1500)
  }

  function handleGenerarFactura() {
    if (!validate()) return
    onGenerarFactura({ mesa: mesa.trim(), monto, tipoPago, notas: notas.trim(), mesero: userName, negocio })
  }

  const neg = negocio ? getNegocio(negocio) : null
  const currentStep = negocio ? 1 : 0

  return (
    <div className="h-full bg-bg flex flex-col">
      <StatusBar
        title={neg ? `${neg.emoji} ${neg.name}` : '🧾 Nueva Solicitud'}
        subtitle={userName}
        onBack={negocio ? () => setNegocio('') : onBack}
      />

      <div className="flex-1 px-4 pt-5 pb-8 max-w-sm mx-auto w-full overflow-y-auto">
        <StepIndicator current={currentStep} steps={STEPS} />

        <AnimatePresence mode="wait">
          {/* ── Paso 0: Selector de negocio ── */}
          {!negocio && (
            <motion.div
              key="negocio-select"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25 }}
            >
              <div className="text-center mb-5">
                <h2 className="text-xl font-bold text-white">¿Para qué negocio?</h2>
                <p className="text-sm text-muted mt-1">Selecciona el establecimiento</p>
              </div>

              <div className="flex flex-col gap-3">
                {NEGOCIO_LIST.map((n) => (
                  <motion.button
                    key={n.id}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setNegocio(n.id)}
                    className="border-2 border-white/10 rounded-xl p-5 flex items-center gap-4 transition-colors"
                    style={{ background: n.theme.headerBg, borderColor: `${n.theme.accent}30` }}
                  >
                    <img
                      src={getLogo(n.logoKey)}
                      alt={n.name}
                      className="h-14 w-14 object-contain rounded-lg"
                    />
                    <div className="text-left flex-1">
                      <p className="text-lg font-bold" style={{ color: n.theme.headerText }}>{n.name}</p>
                      <p className="text-xs mt-0.5" style={{ color: n.theme.accent }}>Solicitar factura</p>
                    </div>
                    <span className="text-2xl" style={{ color: n.theme.accent }}>→</span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── Paso 1: Datos de la mesa ── */}
          {negocio && (
            <motion.div
              key="mesa-form"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25 }}
            >
              <div className="text-center mb-5">
                <h2 className="text-xl font-bold text-white">
                  {neg?.id === 'casaregina' ? 'Datos de la Habitación' : 'Datos de la Mesa'}
                </h2>
                <p className="text-sm text-muted mt-1">Ingresa la información de la orden</p>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.05 }}
                className="bg-surface border border-white/10 rounded-xl p-5"
              >
                {/* Mesa + Monto */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className="block text-xs text-muted font-medium mb-1.5">
                      {neg?.id === 'casaregina' ? 'Habitación' : 'Mesa'}
                    </label>
                    <input
                      value={mesa}
                      onChange={(e) => setMesa(e.target.value)}
                      type="text"
                      inputMode="numeric"
                      placeholder={neg?.id === 'casaregina' ? 'Ej: 204' : 'Ej: 5'}
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

                {/* WhatsApp del cliente */}
                <div className="mb-4">
                  <label className="block text-xs text-muted font-medium mb-1.5">
                    WhatsApp del cliente
                  </label>
                  <input
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    type="tel"
                    inputMode="tel"
                    placeholder="81 1234 5678"
                    className="input"
                    autoComplete="tel"
                  />
                </div>

                {/* Botones de acción */}
                <div className="flex flex-col gap-3">
                  <button
                    onClick={handleEnviarWhatsApp}
                    className="btn w-full text-sm font-bold"
                    style={{ background: '#25D366', color: '#fff' }}
                  >
                    Enviar al cliente
                  </button>

                  <div className="relative flex items-center my-1">
                    <div className="flex-1 border-t border-white/10" />
                    <span className="px-3 text-xs text-muted">o</span>
                    <div className="flex-1 border-t border-white/10" />
                  </div>

                  <button
                    onClick={handleGenerarFactura}
                    className="btn w-full bg-surface2 border border-white/10 text-white text-sm"
                  >
                    Generar factura para el cliente
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
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
