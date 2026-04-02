// ============================================================
// ADMINPAGE.TSX — Panel Admin: Solicitudes / Clientes / Bitácora
// Tabs con FilterPills + SearchBar + pull-to-refresh
// ============================================================

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { StatusBar } from '../components/layout/StatusBar'
import { BottomNav } from '../components/layout/BottomNav'
import { SearchBar } from '../components/shared/SearchBar'
import { FilterPills } from '../components/shared/FilterPills'
import { EmptyState } from '../components/shared/EmptyState'
import { StatBox } from '../components/shared/StatBox'
import { Modal } from '../components/layout/Modal'
import { useToast } from '../hooks/useToast'
import {
  useSolicitudes,
  useClientes,
  useBitacora,
  useUpdateStatus,
  useInvalidate,
} from '../hooks/useSheets'
import { fmt$, isToday } from '../utils/dates'
import type { AdminTab, FilterStatus, Solicitud } from '../api/types'

const TABS: { value: AdminTab; label: string }[] = [
  { value: 'solicitudes', label: '🧾 Solicitudes' },
  { value: 'clientes',    label: '👥 Clientes'    },
  { value: 'bitacora',    label: '📜 Bitácora'    },
]

const STATUS_OPTIONS: { value: FilterStatus; label: string }[] = [
  { value: 'all',       label: 'Todas'     },
  { value: 'Pendiente', label: 'Pendiente' },
  { value: 'Procesada', label: 'Procesada' },
  { value: 'Cancelada', label: 'Cancelada' },
]

const STATUS_BADGE: Record<string, string> = {
  Pendiente: 'bg-warning/15 text-warning',
  Procesada: 'bg-success/15 text-success',
  Cancelada: 'bg-danger/15  text-danger',
}

interface AdminPageProps {
  onNavigate: (step: string) => void
}

export function AdminPage({ onNavigate }: AdminPageProps) {
  const [tab,    setTab   ] = useState<AdminTab>('solicitudes')
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Solicitud | null>(null)

  const { toast } = useToast()
  const invalidate = useInvalidate()
  const updateStatusMut = useUpdateStatus()

  const { data: solicitudes = [], isLoading: loadSol  } = useSolicitudes()
  const { data: clientes    = [], isLoading: loadCli  } = useClientes()
  const { data: bitacora    = [], isLoading: loadBit  } = useBitacora()

  // Pull-to-refresh
  async function handleRefresh() {
    await invalidate.all()
    toast('Datos actualizados')
  }

  // Stats del día
  const hoy = useMemo(() => solicitudes.filter((s) => isToday(s.fecha)), [solicitudes])
  const statsHoy = {
    total:     hoy.length,
    pendientes:hoy.filter((s) => s.status === 'Pendiente').length,
    procesadas:hoy.filter((s) => s.status === 'Procesada').length,
    monto:     hoy.reduce((a, s) => a + parseFloat(s.monto || '0'), 0),
  }

  // Filtrado de solicitudes
  const filteredSolicitudes = useMemo(() => {
    let list = [...solicitudes].reverse()
    if (filter !== 'all') list = list.filter((s) => s.status === filter)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter((s) =>
        s.rfc.toLowerCase().includes(q) ||
        s.razonSocial.toLowerCase().includes(q) ||
        s.mesa.toLowerCase().includes(q) ||
        s.mesero.toLowerCase().includes(q),
      )
    }
    return list
  }, [solicitudes, filter, search])

  // Filtrado de clientes
  const filteredClientes = useMemo(() => {
    if (!search) return clientes
    const q = search.toLowerCase()
    return clientes.filter(
      (c) => c.rfc.toLowerCase().includes(q) || c.razonSocial.toLowerCase().includes(q),
    )
  }, [clientes, search])

  async function handleStatusChange(solId: string, status: string) {
    // Cierre optimista del modal
    setSelected(null)
    ;(async () => {
      try {
        await updateStatusMut.mutateAsync({ solId, status })
        toast(`✅ Marcada como ${status}`)
      } catch {
        toast('Error al actualizar', 'error')
      }
    })()
  }

  return (
    <div className="min-h-dvh bg-bg flex flex-col">
      <StatusBar
        title="⚙️ Administración"
        action={
          <button onClick={handleRefresh} className="btn btn-sm bg-surface2 text-muted border border-white/10">
            ↺
          </button>
        }
      />

      {/* Stats del día */}
      <div className="px-4 pt-4">
        <p className="text-xs text-muted font-semibold uppercase tracking-wider mb-2">Hoy</p>
        <div className="grid grid-cols-4 gap-2 mb-4">
          <StatBox label="Total"    value={statsHoy.total}      />
          <StatBox label="Pend."    value={statsHoy.pendientes} highlight={statsHoy.pendientes > 0} />
          <StatBox label="Proc."    value={statsHoy.procesadas} />
          <StatBox label="Monto"    value={fmt$(statsHoy.monto)} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-4 border-b border-white/10 overflow-x-auto scrollbar-hide">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => { setTab(t.value); setSearch('') }}
            className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
              tab === t.value
                ? 'border-accent text-accent'
                : 'border-transparent text-muted'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Contenido */}
      <div className="flex-1 px-4 pt-4 pb-24 overflow-y-auto">
        <SearchBar value={search} onChange={setSearch} placeholder="Buscar..." />

        {/* ── Solicitudes ─── */}
        {tab === 'solicitudes' && (
          <>
            <FilterPills
              options={STATUS_OPTIONS}
              value={filter}
              onChange={setFilter}
            />
            {loadSol && <SkeletonList n={4} />}
            {!loadSol && filteredSolicitudes.length === 0 && (
              <EmptyState icon="🧾" title="Sin solicitudes" message="Cambia los filtros o registra una nueva" />
            )}
            {filteredSolicitudes.map((s, i) => (
              <motion.div
                key={s.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: Math.min(i * 0.03, 0.3) }}
                className="bg-surface border border-white/10 rounded-xl p-4 mb-2.5"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <p className="text-xs text-muted">{s.id}</p>
                    <p className="font-bold text-white">{s.rfc}</p>
                    <p className="text-xs text-muted">{s.razonSocial}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${STATUS_BADGE[s.status] ?? ''}`}>
                    {s.status}
                  </span>
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-muted mb-3">
                  <span>Mesa {s.mesa}</span>
                  <span>{fmt$(s.monto)}</span>
                  <span>{s.tipoPago}</span>
                  <span>{s.fecha} {s.hora}</span>
                  <span>{s.mesero}</span>
                </div>
                {s.status === 'Pendiente' && (
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => handleStatusChange(s.id, 'Procesada')}
                      className="btn btn-sm bg-success/20 text-success border border-success/30 text-xs"
                    >
                      ✓ Procesar
                    </button>
                    <button
                      onClick={() => setSelected(s)}
                      className="btn btn-sm bg-surface2 text-muted border border-white/10 text-xs"
                    >
                      Ver detalle
                    </button>
                    <button
                      onClick={() => handleStatusChange(s.id, 'Cancelada')}
                      className="btn btn-sm bg-danger/15 text-danger border border-danger/25 text-xs"
                    >
                      ✕ Cancelar
                    </button>
                  </div>
                )}
              </motion.div>
            ))}
          </>
        )}

        {/* ── Clientes ─── */}
        {tab === 'clientes' && (
          <>
            {loadCli && <SkeletonList n={4} />}
            {!loadCli && filteredClientes.length === 0 && (
              <EmptyState icon="👥" title="Sin clientes" />
            )}
            {filteredClientes.map((c, i) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: Math.min(i * 0.03, 0.3) }}
                className="bg-surface border border-white/10 rounded-xl p-4 mb-2.5"
              >
                <p className="font-bold text-white">{c.rfc}</p>
                <p className="text-sm text-muted">{c.razonSocial}</p>
                <div className="flex flex-wrap gap-3 text-xs text-muted mt-2">
                  <span>Reg: {c.regimen}</span>
                  <span>CFDI: {c.usoCfdi}</span>
                  {c.email && <span>{c.email}</span>}
                  {c.ultimaSol && <span>Última sol: {c.ultimaSol}</span>}
                </div>
              </motion.div>
            ))}
          </>
        )}

        {/* ── Bitácora ─── */}
        {tab === 'bitacora' && (
          <>
            {loadBit && <SkeletonList n={4} />}
            {!loadBit && bitacora.length === 0 && (
              <EmptyState icon="📜" title="Bitácora vacía" />
            )}
            {[...bitacora].reverse().slice(0, 100).map((b, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: Math.min(i * 0.02, 0.3) }}
                className="bg-surface border border-white/10 rounded-xl px-4 py-3 mb-2 flex items-start gap-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white">{b.accion}</p>
                  <p className="text-xs text-muted">{b.detalle}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-muted">{b.usuario}</p>
                  <p className="text-xs text-muted">{b.hora}</p>
                </div>
              </motion.div>
            ))}
          </>
        )}
      </div>

      {/* Modal detalle de solicitud */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title="Detalle de Solicitud">
        {selected && (
          <div className="space-y-3">
            <DetailRow label="ID"          value={selected.id} />
            <DetailRow label="RFC"         value={selected.rfc} />
            <DetailRow label="Razón Social" value={selected.razonSocial} />
            <DetailRow label="Mesa"        value={selected.mesa} />
            <DetailRow label="Monto"       value={fmt$(selected.monto)} />
            <DetailRow label="Tipo Pago"   value={selected.tipoPago} />
            <DetailRow label="Régimen"     value={selected.regimen} />
            <DetailRow label="CFDI"        value={selected.usoCfdi} />
            <DetailRow label="Email"       value={selected.email} />
            <DetailRow label="C.P."        value={selected.codigoPostal} />
            <DetailRow label="Mesero"      value={selected.mesero} />
            {selected.notas && <DetailRow label="Notas" value={selected.notas} />}
            <DetailRow label="Status"      value={selected.status} />
            <DetailRow label="Fecha"       value={`${selected.fecha} ${selected.hora}`} />

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => handleStatusChange(selected.id, 'Procesada')}
                className="btn flex-1 bg-success/20 text-success border border-success/30"
              >
                ✓ Procesar
              </button>
              <button
                onClick={() => handleStatusChange(selected.id, 'Cancelada')}
                className="btn flex-1 bg-danger/15 text-danger border border-danger/25"
              >
                ✕ Cancelar
              </button>
            </div>
          </div>
        )}
      </Modal>

      <BottomNav onNavigate={onNavigate} />
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  if (!value) return null
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-muted flex-shrink-0">{label}</span>
      <span className="text-white text-right">{value}</span>
    </div>
  )
}

function SkeletonList({ n }: { n: number }) {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="bg-surface border border-white/10 rounded-xl p-4 animate-pulse">
          <div className="h-4 bg-surface2 rounded w-1/2 mb-2" />
          <div className="h-3 bg-surface2 rounded w-3/4 mb-2" />
          <div className="h-3 bg-surface2 rounded w-1/3" />
        </div>
      ))}
    </div>
  )
}
