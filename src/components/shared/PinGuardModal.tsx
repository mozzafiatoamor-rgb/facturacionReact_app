// ============================================================
// PINGUARDMODAL.TSX — Verificación de PIN antes de acción sensible
// Uso: proteger el regreso a pantalla de monto para que el cliente
// no pueda modificar datos que solo corresponden al mesero.
// ============================================================

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface PinGuardModalProps {
  open:        boolean
  userName:    string       // nombre del mesero a mostrar
  expectedPin: string       // PIN esperado (del usuario en sesión)
  title?:      string
  description?: string
  onSuccess:   () => void   // PIN correcto
  onCancel:    () => void   // cancelar / cerrar
}

function vibrate(ms = 10) {
  try { navigator.vibrate?.(ms) } catch { /* ignore */ }
}

export function PinGuardModal({
  open,
  userName,
  expectedPin,
  title = 'Verificación requerida',
  description,
  onSuccess,
  onCancel,
}: PinGuardModalProps) {
  const [pin,   setPin  ] = useState('')
  const [shake, setShake] = useState(false)
  const [tries, setTries] = useState(0)

  function reset() {
    setPin('')
    setShake(false)
  }

  function handleClose() {
    reset()
    onCancel()
  }

  function verify(current: string) {
    // Sin PIN configurado → acceso libre (usuario guest u old data)
    if (!expectedPin) {
      reset()
      onSuccess()
      return
    }
    if (current === expectedPin) {
      reset()
      vibrate(30)
      onSuccess()
    } else {
      vibrate(80)
      setShake(true)
      setTries((t) => t + 1)
      setTimeout(() => {
        setShake(false)
        setPin('')
      }, 500)
    }
  }

  function pressKey(k: string) {
    if (pin.length >= 4) return
    vibrate()
    const next = pin + k
    setPin(next)
    if (next.length === 4) setTimeout(() => verify(next), 200)
  }

  function delKey() {
    vibrate()
    setPin((p) => p.slice(0, -1))
  }

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
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40"
            onClick={handleClose}
          />

          {/* Panel */}
          <motion.div
            key="panel"
            initial={{ opacity: 0, scale: 0.92, y: 40 }}
            animate={{ opacity: 1, scale: 1,    y: 0  }}
            exit={{    opacity: 0, scale: 0.92, y: 40 }}
            transition={{ type: 'spring', damping: 26, stiffness: 300 }}
            className="fixed inset-x-4 bottom-8 z-50 max-w-xs mx-auto bg-surface border border-white/10 rounded-2xl p-6 shadow-2xl"
          >
            {/* Ícono de seguridad */}
            <div className="text-4xl text-center mb-3">🔐</div>

            <h2 className="text-center text-base font-bold text-white mb-1">
              {title}
            </h2>
            <p className="text-center text-sm text-muted mb-4">
              {description ?? (
                <>
                  Solo <strong className="text-white">{userName}</strong> puede
                  modificar los datos de la mesa.
                  <br />Ingresa tu PIN para continuar.
                </>
              )}
            </p>

            {/* Puntos del PIN */}
            <motion.div
              animate={shake ? { x: [-10, 10, -10, 10, 0] } : {}}
              transition={{ duration: 0.4 }}
              className="flex gap-3 justify-center mb-5"
            >
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-150 ${
                    i < pin.length
                      ? 'bg-accent border-accent scale-110'
                      : 'bg-transparent border-white/30'
                  }`}
                />
              ))}
            </motion.div>

            {/* Aviso de intentos fallidos */}
            {tries > 0 && (
              <p className="text-center text-xs text-danger mb-3">
                PIN incorrecto. Inténtalo de nuevo.
              </p>
            )}

            {/* Teclado 3×4 */}
            <div className="grid grid-cols-3 gap-2 max-w-[200px] mx-auto mb-4">
              {[1,2,3,4,5,6,7,8,9].map((n) => (
                <PinKey key={n} label={String(n)} onPress={() => pressKey(String(n))} />
              ))}
              <PinKey label="⌫" onPress={delKey} muted />
              <PinKey label="0"  onPress={() => pressKey('0')} />
              <PinKey label="OK" onPress={() => verify(pin)} accent disabled={pin.length < 4} />
            </div>

            <button
              onClick={handleClose}
              className="w-full text-center text-xs text-muted py-1"
            >
              Cancelar
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

function PinKey({
  label, onPress, muted, accent, disabled,
}: {
  label:    string
  onPress:  () => void
  muted?:   boolean
  accent?:  boolean
  disabled?: boolean
}) {
  return (
    <motion.button
      whileTap={disabled ? {} : { scale: 0.9 }}
      onClick={onPress}
      disabled={disabled}
      className={`rounded-xl py-3.5 text-lg font-semibold text-center border transition-colors disabled:opacity-30 ${
        accent
          ? 'bg-accent text-white border-accent text-sm'
          : muted
          ? 'bg-surface2 text-muted border-white/10 text-sm'
          : 'bg-surface2 text-white border-white/10'
      }`}
    >
      {label}
    </motion.button>
  )
}
