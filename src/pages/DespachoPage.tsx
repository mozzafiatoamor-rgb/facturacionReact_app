// ============================================================
// DESPACHOPAGE.TSX — Panel del despacho contable
// Acceso via link con token (sin login)
// Lista solicitudes, copiar datos, marcar como procesada
// ============================================================

import { useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchSolicitudes, fetchClientes } from '../api/sheets'
import { updateStatus } from '../api/appscript'
import { QUERY_KEYS, STALE_TIMES } from '../api/config'
import { getLogo } from '../assets/logos'
import { NEGOCIO_LIST, getNegocio } from '../config/businesses'
import { fmt$ } from '../utils/dates'
import type { Solicitud, Cliente } from '../api/types'

type FilterStatus = 'all' | 'Pendiente' | 'Procesada' | 'Cancelada'

const STATUS_COLORS: Record<string, string> = {
  Pendiente: 'bg-yellow-400/15 text-yellow-400 border-yellow-400/30',
  Procesada: 'bg-emerald-400/15 text-emerald-400 border-emerald-400/30',
  Cancelada: 'bg-red-400/15 text-red-400 border-red-400/30',
}

export function DespachoPage() {
  const queryClient = useQueryClient()
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('Pendiente')
  const [filterNegocio, setFilterNegocio] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [updating, setUpdating] = useState<string | null>(null)
  const [copied, setCopied] = useState('')

  const { data: solicitudes = [], isLoading } = useQuery({
    queryKey: QUERY_KEYS.solicitudes,
    queryFn: fetchSolicitudes,
    staleTime: STALE_TIMES.solicitudes,
    refetchInterval: 30_000,
  })

  const { data: clientes = [] } = useQuery({
    queryKey: QUERY_KEYS.clientes,
    queryFn: fetchClientes,
    staleTime: STALE_TIMES.clientes,
  })

  const clienteMap = useMemo(() => {
    const map = new Map<string, Cliente>()
    clientes.forEach((c) => map.set(c.rfc, c))
    return map
  }, [clientes])

  const filtered = useMemo(() => {
    let list = [...solicitudes].reverse() // más recientes primero
    if (filterStatus !== 'all') list = list.filter((s) => s.status === filterStatus)
    if (filterNegocio !== 'all') list = list.filter((s) => (s.negocio || 'mozzafiato') === filterNegocio)
    if (search.trim()) {
      const q = search.trim().toUpperCase()
      list = list.filter((s) =>
        s.id.toUpperCase().includes(q) ||
        s.rfc.toUpperCase().includes(q) ||
        s.razonSocial.toUpperCase().includes(q) ||
        s.mesa.includes(q)
      )
    }
    return list
  }, [solicitudes, filterStatus, filterNegocio, search])

  const counts = useMemo(() => {
    const c = { all: solicitudes.length, Pendiente: 0, Procesada: 0, Cancelada: 0 }
    solicitudes.forEach((s) => { if (s.status in c) c[s.status as keyof typeof c]++ })
    return c
  }, [solicitudes])

  async function handleStatusChange(solId: string, newStatus: string) {
    setUpdating(solId)
    try {
      await updateStatus(solId, newStatus)
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.solicitudes })
    } catch {
      // silencioso — el usuario puede reintentar
    }
    setUpdating(null)
  }

  const copyText = useCallback(async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(label)
      setTimeout(() => setCopied(''), 1500)
    } catch {
      // fallback
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(label)
      setTimeout(() => setCopied(''), 1500)
    }
  }, [])

  return (
    <div className="h-dvh bg-bg flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-surface border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <img src={getLogo('mozzafiato')} alt="Logo" className="h-8 w-auto object-contain flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white">Panel Contable</p>
            <p className="text-xs text-muted">Solicitudes de Facturación</p>
          </div>
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.solicitudes })}
            className="text-xs text-accent px-2 py-1 rounded-lg bg-accent/10 hover:bg-accent/20 transition-colors"
          >
            🔄 Actualizar
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 pt-4 pb-8">
          {/* Contadores */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            {(['all', 'Pendiente', 'Procesada', 'Cancelada'] as const).map((s) => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={`rounded-xl py-2.5 px-2 text-center border-2 text-xs font-semibold transition-colors ${
                  filterStatus === s
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-white/10 bg-surface text-muted'
                }`}>
                <span className="block text-lg font-bold text-white">{counts[s]}</span>
                {s === 'all' ? 'Todas' : s}
              </button>
            ))}
          </div>

          {/* Filtro negocio + búsqueda */}
          <div className="flex gap-2 mb-4">
            <select value={filterNegocio} onChange={(e) => setFilterNegocio(e.target.value)}
              className="input flex-shrink-0 w-auto text-xs">
              <option value="all">Todos los negocios</option>
              {NEGOCIO_LIST.map((n) => (
                <option key={n.id} value={n.id}>{n.emoji} {n.name}</option>
              ))}
            </select>
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar folio, RFC, razón social..."
              className="input flex-1 text-xs" />
          </div>

          {/* Toast de copiado */}
          <AnimatePresence>
            {copied && (
              <motion.div
                initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                className="fixed top-16 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-full z-50 shadow-lg"
              >
                ✅ {copied} copiado
              </motion.div>
            )}
          </AnimatePresence>

          {/* Loading */}
          {isLoading && (
            <div className="flex justify-center py-12">
              <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* Empty */}
          {!isLoading && filtered.length === 0 && (
            <div className="text-center py-12">
              <span className="text-4xl block mb-3">📋</span>
              <p className="text-white font-semibold">No hay solicitudes</p>
              <p className="text-muted text-xs mt-1">Ajusta los filtros o espera nuevas solicitudes</p>
            </div>
          )}

          {/* Lista */}
          <div className="space-y-3">
            {filtered.map((sol) => (
              <SolicitudCard
                key={sol.id}
                sol={sol}
                cliente={clienteMap.get(sol.rfc)}
                expanded={expandedId === sol.id}
                onToggle={() => setExpandedId(expandedId === sol.id ? null : sol.id)}
                onCopy={copyText}
                onStatusChange={handleStatusChange}
                updating={updating === sol.id}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Card de solicitud ────────────────────────────────────────
interface SolicitudCardProps {
  sol: Solicitud
  cliente?: Cliente
  expanded: boolean
  onToggle: () => void
  onCopy: (text: string, label: string) => void
  onStatusChange: (solId: string, status: string) => void
  updating: boolean
}

function SolicitudCard({ sol, cliente, expanded, onToggle, onCopy, onStatusChange, updating }: SolicitudCardProps) {
  const neg = getNegocio(sol.negocio || 'mozzafiato')
  const statusClass = STATUS_COLORS[sol.status] ?? ''

  return (
    <motion.div layout className="bg-surface border border-white/10 rounded-xl overflow-hidden">
      {/* Header — siempre visible */}
      <button onClick={onToggle} className="w-full text-left px-4 py-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-accent">{sol.id}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-muted">
              {neg.emoji} {neg.name}
            </span>
          </div>
          <p className="text-sm font-semibold text-white truncate">{sol.razonSocial || sol.rfc}</p>
          <p className="text-xs text-muted mt-0.5">
            Mesa {sol.mesa} · {fmt$(sol.monto)} · {sol.fecha} {sol.hora}
          </p>
        </div>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full border whitespace-nowrap ${statusClass}`}>
          {sol.status}
        </span>
        <span className={`text-muted text-xs transition-transform ${expanded ? 'rotate-180' : ''}`}>▼</span>
      </button>

      {/* Detalle expandido */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-white/10 pt-3">
              {/* Datos copiables */}
              <p className="text-xs text-accent font-semibold uppercase tracking-wider mb-2">
                Datos del cliente (toca para copiar)
              </p>
              <div className="grid grid-cols-1 gap-1.5 mb-4">
                <CopyField label="RFC" value={sol.rfc} onCopy={onCopy} />
                <CopyField label="Razón Social" value={sol.razonSocial} onCopy={onCopy} />
                <CopyField label="Régimen" value={sol.regimen} onCopy={onCopy} />
                <CopyField label="Uso CFDI" value={sol.usoCfdi} onCopy={onCopy} />
                <CopyField label="Email" value={sol.email} onCopy={onCopy} />
                <CopyField label="C.P." value={sol.codigoPostal || cliente?.codigoPostal || '—'} onCopy={onCopy} />
                {(cliente?.telefono) && (
                  <CopyField label="Teléfono" value={cliente.telefono} onCopy={onCopy} />
                )}
              </div>

              {/* Datos del pedido */}
              <p className="text-xs text-muted font-semibold uppercase tracking-wider mb-2">Pedido</p>
              <div className="grid grid-cols-3 gap-2 text-xs mb-4">
                <div><span className="text-muted">Mesa:</span> <span className="text-white font-bold">{sol.mesa}</span></div>
                <div><span className="text-muted">Monto:</span> <span className="text-white font-bold">{fmt$(sol.monto)}</span></div>
                <div><span className="text-muted">Pago:</span> <span className="text-white">{sol.tipoPago}</span></div>
                <div><span className="text-muted">Mesero:</span> <span className="text-white">{sol.mesero}</span></div>
                <div><span className="text-muted">Fecha:</span> <span className="text-white">{sol.fecha}</span></div>
                <div><span className="text-muted">Hora:</span> <span className="text-white">{sol.hora}</span></div>
              </div>
              {sol.notas && (
                <p className="text-xs text-muted mb-4">📝 {sol.notas}</p>
              )}

              {/* Botón copiar todo */}
              <button
                onClick={() => {
                  const all = [
                    `RFC: ${sol.rfc}`,
                    `Razón Social: ${sol.razonSocial}`,
                    `Régimen: ${sol.regimen}`,
                    `Uso CFDI: ${sol.usoCfdi}`,
                    `Email: ${sol.email}`,
                    `C.P.: ${sol.codigoPostal || '—'}`,
                    `Monto: $${sol.monto}`,
                    `Tipo de Pago: ${sol.tipoPago}`,
                  ].join('\n')
                  onCopy(all, 'Todos los datos')
                }}
                className="btn w-full bg-surface2 border border-white/10 text-white text-xs mb-3"
              >
                📋 Copiar todos los datos fiscales
              </button>

              {/* Acciones de estatus */}
              <div className="flex gap-2">
                {sol.status === 'Pendiente' && (
                  <button
                    onClick={() => onStatusChange(sol.id, 'Procesada')}
                    disabled={updating}
                    className="btn flex-1 bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-bold disabled:opacity-50"
                  >
                    {updating ? '⏳ Procesando...' : '✅ Marcar como Procesada'}
                  </button>
                )}
                {sol.status === 'Pendiente' && (
                  <button
                    onClick={() => onStatusChange(sol.id, 'Cancelada')}
                    disabled={updating}
                    className="btn bg-red-500/20 border border-red-500/40 text-red-400 text-xs disabled:opacity-50"
                  >
                    ❌
                  </button>
                )}
                {sol.status === 'Procesada' && (
                  <button
                    onClick={() => onStatusChange(sol.id, 'Pendiente')}
                    disabled={updating}
                    className="btn flex-1 bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 text-xs disabled:opacity-50"
                  >
                    ↩️ Regresar a Pendiente
                  </button>
                )}
                {sol.status === 'Cancelada' && (
                  <button
                    onClick={() => onStatusChange(sol.id, 'Pendiente')}
                    disabled={updating}
                    className="btn flex-1 bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 text-xs disabled:opacity-50"
                  >
                    ↩️ Reactivar
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ── Campo copiable ───────────────────────────────────────────
function CopyField({ label, value, onCopy }: { label: string; value: string; onCopy: (text: string, label: string) => void }) {
  if (!value || value === '—') {
    return (
      <div className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-white/3">
        <span className="text-xs text-muted">{label}</span>
        <span className="text-xs text-muted">—</span>
      </div>
    )
  }
  return (
    <button
      onClick={() => onCopy(value, label)}
      className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-white/5 hover:bg-accent/10 transition-colors text-left w-full group"
    >
      <span className="text-xs text-muted flex-shrink-0 mr-2">{label}</span>
      <span className="text-xs text-white font-medium truncate flex-1 text-right">{value}</span>
      <span className="text-[10px] text-muted ml-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">📋</span>
    </button>
  )
}
