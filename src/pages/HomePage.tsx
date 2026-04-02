// ============================================================
// HOMEPAGE.TSX — Resumen del día + acceso rápido
// ============================================================

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '../auth/AuthContext'
import { useSolicitudes } from '../hooks/useSheets'
import { StatusBar } from '../components/layout/StatusBar'
import { BottomNav } from '../components/layout/BottomNav'
import { StatBox } from '../components/shared/StatBox'
import { EmptyState } from '../components/shared/EmptyState'
import { fmt$, isToday } from '../utils/dates'

const STATUS_BADGE: Record<string, string> = {
  Pendiente: 'bg-warning/15 text-warning',
  Procesada: 'bg-success/15 text-success',
  Cancelada: 'bg-danger/15  text-danger',
}

interface HomePageProps {
  onNavigate: (step: string) => void
}

export function HomePage({ onNavigate }: HomePageProps) {
  const { user } = useAuth()
  const { data: solicitudes = [], isLoading } = useSolicitudes()

  const hoy = useMemo(() => solicitudes.filter((s) => isToday(s.fecha)), [solicitudes])
  const misSolicitudes = useMemo(
    () => hoy.filter((s) => s.mesero === user?.nombre).slice(0, 5),
    [hoy, user],
  )

  const totalHoy   = hoy.length
  const pendientes = hoy.filter((s) => s.status === 'Pendiente').length
  const montoHoy   = hoy.reduce((acc, s) => acc + parseFloat(s.monto || '0'), 0)

  return (
    <div className="min-h-dvh bg-bg flex flex-col">
      <StatusBar
        action={
          <button
            onClick={() => onNavigate('mesero')}
            className="btn btn-sm bg-accent text-white text-xs"
          >
            + Nueva
          </button>
        }
      />

      <div className="flex-1 px-4 pt-5 pb-24 max-w-lg mx-auto w-full">
        {/* Bienvenida */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5"
        >
          <h1 className="text-xl font-bold text-white">
            ¡Hola, {user?.nombre?.split(' ')[0] ?? 'Usuario'}! 👋
          </h1>
          <p className="text-sm text-muted mt-0.5">Resumen del día de hoy</p>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2.5 mb-6">
          <StatBox label="Solicitudes" value={totalHoy} icon="🧾" />
          <StatBox label="Pendientes"  value={pendientes} icon="⏳" highlight={pendientes > 0} />
          <StatBox label="Total"       value={fmt$(montoHoy)} icon="💰" />
        </div>

        {/* Mis solicitudes recientes */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
            Mis solicitudes recientes
          </p>

          {isLoading && <SkeletonList />}

          {!isLoading && misSolicitudes.length === 0 && (
            <EmptyState
              icon="🧾"
              title="Sin solicitudes hoy"
              message="Presiona + Nueva para registrar una solicitud de factura"
              action={
                <button
                  onClick={() => onNavigate('mesero')}
                  className="btn btn-primary"
                >
                  + Nueva Solicitud
                </button>
              }
            />
          )}

          {misSolicitudes.map((s, i) => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              className="bg-surface border border-white/10 rounded-xl p-3.5 mb-2.5 flex items-center justify-between"
            >
              <div>
                <p className="text-sm font-semibold text-white">
                  Mesa {s.mesa} · {fmt$(s.monto)}
                </p>
                <p className="text-xs text-muted mt-0.5">
                  {s.rfc} · {s.hora}
                </p>
              </div>
              <span
                className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                  STATUS_BADGE[s.status] ?? 'bg-muted/15 text-muted'
                } ${s._optimistic ? 'opacity-60' : ''}`}
              >
                {s._optimistic ? '⏳ Sync...' : s.status}
              </span>
            </motion.div>
          ))}
        </div>

        {/* Acceso rápido para admin */}
        {(user?.rol === 'admin' || user?.rol === 'contable') && (
          <button
            onClick={() => onNavigate('admin')}
            className="btn w-full bg-surface border border-white/10 text-white"
          >
            ⚙️ Panel de Administración
          </button>
        )}
      </div>

      <BottomNav onNavigate={onNavigate} />
    </div>
  )
}

function SkeletonList() {
  return (
    <div className="space-y-2.5">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-surface border border-white/10 rounded-xl p-3.5 animate-pulse">
          <div className="h-3.5 bg-surface2 rounded w-2/3 mb-2" />
          <div className="h-3 bg-surface2 rounded w-1/3" />
        </div>
      ))}
    </div>
  )
}
