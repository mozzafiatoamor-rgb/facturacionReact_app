// ============================================================
// ADMINPAGE.TSX — Panel Admin: Solicitudes / Clientes / Bitácora
// Tabs con FilterPills + SearchBar + pull-to-refresh
// ============================================================

import { useState, useMemo, useCallback } from 'react'
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
import { encodeDespacho } from '../utils/llevar'
import { listInvoices } from '../api/appscript'
import type { FacturapiInvoice } from '../api/appscript'
import type { AdminTab, FilterStatus, Solicitud } from '../api/types'

const TABS: { value: AdminTab; label: string }[] = [
  { value: 'facturacion', label: '📊 Facturación' },
  { value: 'solicitudes', label: '🧾 Solicitudes' },
  { value: 'clientes',    label: '👥 Clientes'    },
  { value: 'bitacora',    label: '📜 Bitácora'    },
]

const PAYMENT_FORMS: Record<string, string> = {
  '01': 'Efectivo', '03': 'Transferencia', '04': 'T. Crédito', '28': 'T. Débito', '99': 'Por definir',
}

function getMonthRange(offset = 0) {
  const d = new Date()
  d.setMonth(d.getMonth() + offset)
  const y = d.getFullYear()
  const m = d.getMonth()
  const from = `${y}-${String(m + 1).padStart(2, '0')}-01`
  const last = new Date(y, m + 1, 0).getDate()
  const to = `${y}-${String(m + 1).padStart(2, '0')}-${String(last).padStart(2, '0')}`
  const label = d.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
  return { from, to, label }
}

function formatDate(iso: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

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
  const [tab,    setTab   ] = useState<AdminTab>('facturacion')
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Solicitud | null>(null)

  // ── Facturación tab state ──
  const [monthOffset, setMonthOffset] = useState(0)
  const [invoices, setInvoices] = useState<FacturapiInvoice[]>([])
  const [loadingInv, setLoadingInv] = useState(false)
  const [invError, setInvError] = useState('')
  const [invSearch, setInvSearch] = useState('')
  const [invLoaded, setInvLoaded] = useState(false)

  const monthRange = useMemo(() => getMonthRange(monthOffset), [monthOffset])

  const loadInvoices = useCallback(async () => {
    setLoadingInv(true)
    setInvError('')
    try {
      const data = await listInvoices(monthRange.from, monthRange.to)
      setInvoices(data)
      setInvLoaded(true)
    } catch (err) {
      setInvError(err instanceof Error ? err.message : 'Error al cargar facturas')
    } finally {
      setLoadingInv(false)
    }
  }, [monthRange.from, monthRange.to])

  // Auto-load when switching to facturacion tab or changing month
  const prevMonth = useMemo(() => monthRange.from, [monthRange.from])
  useMemo(() => {
    if (tab === 'facturacion') {
      setInvLoaded(false)
    }
  }, [prevMonth]) // eslint-disable-line

  const filteredInvoices = useMemo(() => {
    let list = invoices.filter(inv => inv.cancellationStatus !== 'accepted')
    if (invSearch) {
      const q = invSearch.toLowerCase()
      list = list.filter(inv =>
        inv.customerRfc.toLowerCase().includes(q) ||
        inv.customerName.toLowerCase().includes(q) ||
        String(inv.folioNumber).includes(q) ||
        inv.uuid.toLowerCase().includes(q)
      )
    }
    return list
  }, [invoices, invSearch])

  const invSummary = useMemo(() => {
    const active = invoices.filter(inv => inv.cancellationStatus !== 'accepted')
    const summarize = (list: FacturapiInvoice[]) => ({
      count: list.length,
      total: list.reduce((a, i) => a + i.total, 0),
      subtotal: list.reduce((a, i) => a + i.subtotal, 0),
      iva: list.reduce((a, i) => a + i.iva, 0),
      isr: list.reduce((a, i) => a + i.isr, 0),
      ish: list.reduce((a, i) => a + i.ish, 0),
    })
    return {
      all: summarize(active),
      mozz: summarize(active.filter(i => i.series === 'MOZZ')),
      regina: summarize(active.filter(i => i.series === 'REGINA')),
    }
  }, [invoices])

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
    <div className="h-full bg-bg flex flex-col">
      <StatusBar
        title="⚙️ Administración"
        action={
          <button onClick={handleRefresh} className="btn btn-sm bg-surface2 text-muted border border-white/10">
            ↺
          </button>
        }
      />

      {/* Stats del día + link despacho */}
      <div className="px-4 pt-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-muted font-semibold uppercase tracking-wider">Hoy</p>
          <div className="flex gap-1.5">
            <button
              onClick={() => onNavigate('despacho')}
              className="text-[10px] text-purple-400 px-2 py-1 rounded-lg bg-purple-400/10 hover:bg-purple-400/20 transition-colors"
            >
              📋 Vista Contable
            </button>
            <button
              onClick={() => {
                const base = window.location.origin + import.meta.env.BASE_URL
                const token = encodeDespacho()
                const url = `${base}?despacho=${token}`
                navigator.clipboard.writeText(url).then(
                  () => toast('📋 Link del despacho copiado al portapapeles'),
                  () => {
                    prompt('Copia este link:', url)
                    toast('Link generado')
                  }
                )
              }}
              className="text-[10px] text-accent px-2 py-1 rounded-lg bg-accent/10 hover:bg-accent/20 transition-colors"
            >
              🔗 Link Despacho
            </button>
          </div>
        </div>
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
        {tab !== 'facturacion' && (
          <SearchBar value={search} onChange={setSearch} placeholder="Buscar..." />
        )}

        {/* ── Facturación ─── */}
        {tab === 'facturacion' && (
          <>
            {/* Selector de mes */}
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => { setMonthOffset(o => o - 1); setInvLoaded(false) }}
                className="btn btn-sm bg-surface2 text-muted border border-white/10 text-lg px-3">←</button>
              <p className="text-sm font-bold text-white capitalize">{monthRange.label}</p>
              <button onClick={() => { setMonthOffset(o => o + 1); setInvLoaded(false) }}
                disabled={monthOffset >= 0}
                className="btn btn-sm bg-surface2 text-muted border border-white/10 text-lg px-3 disabled:opacity-30">→</button>
            </div>

            {/* Botón cargar */}
            {!invLoaded && !loadingInv && (
              <button onClick={loadInvoices}
                className="btn w-full bg-accent/20 text-accent border border-accent/30 text-sm font-bold mb-4">
                Cargar facturas de {monthRange.label}
              </button>
            )}

            {loadingInv && <div className="text-center py-8"><div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-2" /><p className="text-muted text-xs">Consultando Facturapi...</p></div>}
            {invError && <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-4 text-red-400 text-xs">{invError}</div>}

            {invLoaded && !loadingInv && (
              <>
                {/* Resumen por negocio */}
                {[
                  { key: 'mozz', label: 'Mozzafiato', data: invSummary.mozz, accent: '#c8a97e' },
                  { key: 'regina', label: 'Casa Regina', data: invSummary.regina, accent: '#C9A84C' },
                ].map(biz => biz.data.count > 0 && (
                  <div key={biz.key} className="bg-surface border border-white/10 rounded-xl p-4 mb-3">
                    <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: biz.accent }}>{biz.label} ({biz.data.count} facturas)</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex justify-between"><span className="text-muted">Subtotal</span><span className="text-white font-bold">{fmt$(biz.data.subtotal)}</span></div>
                      <div className="flex justify-between"><span className="text-muted">IVA</span><span className="text-green-400 font-bold">{fmt$(biz.data.iva)}</span></div>
                      <div className="flex justify-between"><span className="text-muted">ISR Ret.</span><span className="text-red-400 font-bold">{biz.data.isr > 0 ? `-${fmt$(biz.data.isr)}` : '$0'}</span></div>
                      <div className="flex justify-between"><span className="text-muted">ISH</span><span className="text-blue-400 font-bold">{biz.data.ish > 0 ? fmt$(biz.data.ish) : '$0'}</span></div>
                      <div className="col-span-2 flex justify-between border-t border-white/10 pt-2"><span className="text-white font-semibold">Total</span><span className="font-bold text-base" style={{ color: biz.accent }}>{fmt$(biz.data.total)}</span></div>
                    </div>
                  </div>
                ))}

                {/* Total general */}
                <div className="bg-surface border border-accent/30 rounded-xl p-4 mb-4">
                  <p className="text-xs text-accent font-semibold uppercase tracking-wider mb-3">Total General ({invSummary.all.count} facturas)</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted">Subtotal</span><span className="text-white font-bold">{fmt$(invSummary.all.subtotal)}</span></div>
                    <div className="flex justify-between"><span className="text-muted">IVA</span><span className="text-green-400 font-bold">{fmt$(invSummary.all.iva)}</span></div>
                    <div className="flex justify-between"><span className="text-muted">ISR Ret.</span><span className="text-red-400 font-bold">{invSummary.all.isr > 0 ? `-${fmt$(invSummary.all.isr)}` : '$0'}</span></div>
                    <div className="flex justify-between"><span className="text-muted">ISH</span><span className="text-blue-400 font-bold">{invSummary.all.ish > 0 ? fmt$(invSummary.all.ish) : '$0'}</span></div>
                    <div className="col-span-2 flex justify-between border-t border-white/10 pt-2"><span className="text-white font-semibold">Total Facturado</span><span className="text-accent font-bold text-lg">{fmt$(invSummary.all.total)}</span></div>
                  </div>
                </div>

                {/* Búsqueda */}
                <SearchBar value={invSearch} onChange={setInvSearch} placeholder="Buscar RFC, razón social, folio..." />

                {/* Lista de facturas */}
                {filteredInvoices.length === 0 && (
                  <EmptyState icon="📊" title="Sin facturas" message={invSearch ? 'No hay coincidencias' : 'No hay facturas en este periodo'} />
                )}
                {filteredInvoices.map((inv, i) => (
                  <motion.div
                    key={inv.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i * 0.03, 0.3) }}
                    className="bg-surface border border-white/10 rounded-xl p-4 mb-2.5"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <p className="text-xs text-muted">Folio {inv.series}{inv.folioNumber}</p>
                        <p className="font-bold text-white truncate">{inv.customerRfc}</p>
                        <p className="text-xs text-muted truncate">{inv.customerName}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-accent font-bold">{fmt$(inv.total)}</p>
                        <p className="text-xs text-muted">{formatDate(inv.date)}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[10px] text-muted">
                      <span className="bg-surface2 rounded px-1.5 py-0.5">IVA: {fmt$(inv.iva)}</span>
                      {inv.isr > 0 && <span className="bg-red-500/10 text-red-400 rounded px-1.5 py-0.5">ISR: -{fmt$(inv.isr)}</span>}
                      {inv.ish > 0 && <span className="bg-blue-500/10 text-blue-400 rounded px-1.5 py-0.5">ISH: {fmt$(inv.ish)}</span>}
                      <span className="bg-surface2 rounded px-1.5 py-0.5">{PAYMENT_FORMS[String(inv.paymentForm)] || inv.paymentForm}</span>
                      <span className="bg-surface2 rounded px-1.5 py-0.5 font-mono">{inv.uuid.slice(0, 8)}...</span>
                    </div>
                  </motion.div>
                ))}
              </>
            )}
          </>
        )}

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
