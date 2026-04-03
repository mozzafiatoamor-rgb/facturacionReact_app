// ============================================================
// LOGINSCREEN.TSX — Selección de usuario + PIN numérico
// Haptic feedback en cada tecla (navigator.vibrate)
// ============================================================

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from './AuthContext'
import { useUsuarios } from '../hooks/useSheets'
import type { Usuario } from '../api/types'
import { useToast } from '../hooks/useToast'

const B = import.meta.env.BASE_URL
const SRCS = [`${B}logo.png`, `${B}icon-192.png`]
const ROL_LABEL: Record<string, string> = {
  mesero:   '🍽️ Mesero',
  admin:    '⚙️ Admin',
  contable: '📊 Contable',
}

function vibrate(ms = 10) {
  try { navigator.vibrate?.(ms) } catch { /* ignore */ }
}

export function LoginScreen() {
  const { login, setStep, config } = useAuth()
  const { toast } = useToast()
  const { data: usuarios = [], isLoading, isError } = useUsuarios()

  const [selected, setSelected] = useState<Usuario | null>(null)
  const [pin, setPin] = useState('')
  const [shake, setShake] = useState(false)

  const active = usuarios.filter((u) => u.activo)

  function selectUser(u: Usuario) {
    setSelected(u)
    setPin('')
  }

  const verify = useCallback(
    (current: string) => {
      if (!selected) return
      if (!selected.pin || selected.pin === current) {
        login(selected)
        toast(`¡Bienvenido, ${selected.nombre}!`)
      } else {
        vibrate(80)
        setShake(true)
        setTimeout(() => setShake(false), 500)
        setPin('')
        toast('PIN incorrecto', 'error')
      }
    },
    [selected, login, toast],
  )

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

  const isConnected = !isLoading && !isError && active.length > 0

  return (
    <div className="h-full bg-bg flex flex-col">
      {/* Header */}
      <div className="bg-surface border-b border-white/10 px-4 py-3 flex items-center gap-2.5 sticky top-0 z-10">
        <LoginLogo />
        <span className="flex-1 text-base font-bold text-white">
          Mozzafiato Facturas
        </span>
        {/* Status dot */}
        <span
          className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
            isLoading  ? 'bg-warning' :
            isConnected ? 'bg-success'  : 'bg-danger'
          }`}
          title={isLoading ? 'Conectando...' : isConnected ? 'Conectado' : 'Sin conexión'}
        />
        <button
          onClick={() => setStep('setup')}
          className="btn btn-sm bg-surface2 text-white border border-white/10"
        >
          ⚙️
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 px-4 pt-6 pb-8 max-w-sm mx-auto w-full overflow-y-auto">
        <div className="text-center mb-5">
          <h2 className="text-2xl font-bold text-white">Iniciar Sesión</h2>
          <p className="text-sm text-muted mt-1">Selecciona tu usuario</p>
        </div>

        {/* Estado de carga / error / vacío */}
        {isLoading && <LoadingUsers />}

        {!isLoading && (isError || !config?.sheetId) && (
          <ErrorState onRetry={() => window.location.reload()} />
        )}

        {!isLoading && !isError && active.length === 0 && (
          <EmptyUsers />
        )}

        {/* Grid de usuarios */}
        {!isLoading && active.length > 0 && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            {active.map((u) => (
              <motion.button
                key={u.id}
                whileTap={{ scale: 0.96 }}
                onClick={() => selectUser(u)}
                className={`rounded-xl p-4 text-center border-2 transition-colors ${
                  selected?.id === u.id
                    ? 'border-accent bg-accent/10'
                    : 'border-white/10 bg-surface2'
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-accent text-white font-bold text-lg flex items-center justify-center mx-auto mb-2">
                  {u.nombre[0]?.toUpperCase() ?? '?'}
                </div>
                <div className="font-semibold text-white text-sm">{u.nombre}</div>
                <div className="text-xs text-muted mt-0.5">
                  {ROL_LABEL[u.rol] ?? u.rol}
                </div>
              </motion.button>
            ))}
          </div>
        )}

        {/* PIN pad */}
        <AnimatePresence>
          {selected && (
            <motion.div
              key="pin"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.2 }}
              className="bg-surface border border-white/10 rounded-xl p-5"
            >
              <p className="text-sm text-muted text-center mb-4">
                PIN de <strong className="text-white">{selected.nombre}</strong>
              </p>

              {/* Puntos */}
              <motion.div
                animate={shake ? { x: [-8, 8, -8, 8, 0] } : {}}
                transition={{ duration: 0.4 }}
                className="flex gap-3 justify-center mb-5"
              >
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={`w-4 h-4 rounded-full border-2 transition-all ${
                      i < pin.length
                        ? 'bg-accent border-accent'
                        : 'bg-transparent border-white/30'
                    }`}
                  />
                ))}
              </motion.div>

              {/* Teclado 3×4 */}
              <div className="grid grid-cols-3 gap-2.5 max-w-[240px] mx-auto">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                  <PinKey key={n} label={String(n)} onPress={() => pressKey(String(n))} />
                ))}
                <PinKey label="⌫" onPress={delKey} muted />
                <PinKey label="0" onPress={() => pressKey('0')} />
                <PinKey label="OK" onPress={() => verify(pin)} accent />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Botón invitado */}
        {!isLoading && !isConnected && (
          <div className="text-center mt-4">
            <button
              onClick={() =>
                login({ id: 'guest', nombre: 'Invitado', rol: 'mesero', pin: '', activo: true, _row: -1 })
              }
              className="btn btn-sm bg-surface2 text-muted border border-white/10"
            >
              Entrar como invitado
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Sub-componentes ────────────────────────────────────────

function PinKey({
  label,
  onPress,
  muted,
  accent,
}: {
  label: string
  onPress: () => void
  muted?: boolean
  accent?: boolean
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.92 }}
      onClick={onPress}
      className={`rounded-xl py-4 text-xl font-semibold text-center border transition-colors ${
        accent
          ? 'bg-accent text-white border-accent'
          : muted
          ? 'bg-surface2 text-muted border-white/10 text-sm'
          : 'bg-surface2 text-white border-white/10'
      }`}
    >
      {label}
    </motion.button>
  )
}

function LoadingUsers() {
  return (
    <div className="text-center py-10">
      <div className="w-8 h-8 border-2 border-white/20 border-t-accent rounded-full animate-spin mx-auto mb-3" />
      <p className="text-sm text-muted">Conectando con el Sheet...</p>
    </div>
  )
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="bg-danger/10 border border-danger/30 rounded-xl p-5 text-center mb-4">
      <div className="text-4xl mb-2">⚠️</div>
      <p className="font-bold text-danger mb-1">Error de conexión</p>
      <p className="text-xs text-muted mb-4 leading-relaxed">
        No se pudo conectar al Sheet.
        <br />
        Verifica que el Sheet ID, API Key y URL del Script sean correctos.
      </p>
      <button onClick={onRetry} className="btn btn-primary w-full mb-2">
        ↺ Reintentar
      </button>
    </div>
  )
}

function LoginLogo() {
  const [idx, setIdx] = useState(0)
  if (idx >= SRCS.length) return <span className="text-2xl flex-shrink-0">🧾</span>
  return (
    <img
      key={SRCS[idx]}
      src={SRCS[idx]}
      alt="Logo"
      className="h-8 w-auto object-contain flex-shrink-0"
      onError={() => setIdx((i) => i + 1)}
    />
  )
}

function EmptyUsers() {
  return (
    <div className="bg-warning/10 border border-warning/25 rounded-xl p-5 text-center mb-4">
      <div className="text-4xl mb-2">👤</div>
      <p className="font-bold text-white mb-2">Sin usuarios configurados</p>
      <p className="text-xs text-muted text-left leading-relaxed">
        La pestaña debe llamarse exactamente:
        <br />
        <code className="bg-surface2 px-2 py-0.5 rounded text-sm inline-block my-1">
          👤 Usuarios
        </code>
        <br />
        Con las columnas en fila 1:
        <br />
        <code className="bg-surface2 px-2 py-0.5 rounded text-xs inline-block mt-1">
          ID · Nombre · PIN · Rol · Activo
        </code>
      </p>
    </div>
  )
}
