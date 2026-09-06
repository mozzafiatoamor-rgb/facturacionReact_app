// ============================================================
// ADMINPAGE.TSX — Panel Admin: Solicitudes / Clientes / Bitácora
// Tabs con FilterPills + SearchBar + pull-to-refresh
// ============================================================

import { useState, useMemo, useCallback, useEffect } from 'react'
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
import { listInvoices, savePromos, cancelInvoice, downloadAcuse } from '../api/appscript'
import { fetchPromoRows, groupPromos } from '../api/sheets'
import { NEGOCIOS } from '../config/businesses'
import { getLogo } from '../assets/logos'
import type { FacturapiInvoice } from '../api/appscript'
import type { AdminTab, FilterStatus, Solicitud } from '../api/types'

const TABS: { value: AdminTab; label: string }[] = [
  { value: 'facturacion', label: '📊 Facturación' },
  { value: 'solicitudes', label: '🧾 Solicitudes' },
  { value: 'clientes',    label: '👥 Clientes'    },
  { value: 'bitacora',    label: '📜 Bitácora'    },
  { value: 'promos',      label: '📢 Promos'      },
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

  // ── Cancel invoice state ──
  const [cancelTarget, setCancelTarget] = useState<FacturapiInvoice | null>(null)
  const [cancelMotive, setCancelMotive] = useState('02')
  const [cancelling, setCancelling] = useState(false)
  const [cancelAcuse, setCancelAcuse] = useState<{ uuid: string; pdf: string } | null>(null)
  const [downloadingAcuseId, setDownloadingAcuseId] = useState<string | null>(null)

  // ── Promos tab state ──
  interface PromoState { headline: string; tagline: string; buttons: { cta: string; link: string }[] }
  const defaultPromos: Record<string, PromoState> = {
    mozzafiato: {
      headline: '¿Buscas hospedaje en Playa del Carmen?',
      tagline: 'Casa Regina Hotel Boutique te espera con habitaciones de lujo y la mejor ubicación.',
      buttons: [{ cta: 'Síguenos en Facebook', link: 'https://www.facebook.com/share/1HwxUyNepJ/' }],
    },
    casaregina: {
      headline: '¿Se te antoja la mejor pizza artesanal?',
      tagline: 'Visita Mozzafiato — auténtica cocina italiana con horno de leña.',
      buttons: [{ cta: 'Síguenos en Facebook', link: 'https://www.facebook.com/share/1EruEYRtUC/' }],
    },
  }
  const [promoMozz, setPromoMozz] = useState<PromoState>(defaultPromos.mozzafiato)
  const [promoRegina, setPromoRegina] = useState<PromoState>(defaultPromos.casaregina)
  const [promosLoaded, setPromosLoaded] = useState(false)
  const [savingPromos, setSavingPromos] = useState(false)
  const [promoSaved, setPromoSaved] = useState(false)

  useEffect(() => {
    if (tab === 'promos' && !promosLoaded) {
      fetchPromoRows().then(rows => {
        const grouped = groupPromos(rows)
        for (const g of grouped) {
          if (g.negocio === 'mozzafiato' && g.headline) {
            setPromoMozz({ headline: g.headline, tagline: g.tagline, buttons: g.buttons })
          }
          if (g.negocio === 'casaregina' && g.headline) {
            setPromoRegina({ headline: g.headline, tagline: g.tagline, buttons: g.buttons })
          }
        }
        setPromosLoaded(true)
      }).catch(() => setPromosLoaded(true))
    }
  }, [tab, promosLoaded])

  async function handleSavePromos() {
    setSavingPromos(true)
    setPromoSaved(false)
    try {
      // Flatten: primera fila con headline+tagline, extras solo CTA+link
      const flat: { negocio: string; headline: string; tagline: string; cta: string; link: string }[] = []
      for (const [neg, state] of [['mozzafiato', promoMozz], ['casaregina', promoRegina]] as const) {
        state.buttons.forEach((btn, i) => {
          flat.push({
            negocio: neg,
            headline: i === 0 ? state.headline : '',
            tagline: i === 0 ? state.tagline : '',
            cta: btn.cta,
            link: btn.link,
          })
        })
      }
      await savePromos(flat)
      setPromoSaved(true)
      toast('Promos guardadas')
      setTimeout(() => setPromoSaved(false), 3000)
    } catch {
      toast('Error al guardar promos', 'error')
    } finally {
      setSavingPromos(false)
    }
  }

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

  async function handleCancelInvoice() {
    if (!cancelTarget) return
    setCancelling(true)
    try {
      const res = await cancelInvoice(cancelTarget.id, cancelMotive)
      if (res.acusePdfBase64) {
        setCancelAcuse({ uuid: cancelTarget.uuid, pdf: res.acusePdfBase64 })
      }
      toast('Factura cancelada correctamente')
      setCancelTarget(null)
      // Auto-reload invoices to reflect new status
      loadInvoices()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error al cancelar', 'error')
    } finally {
      setCancelling(false)
    }
  }

  function downloadBase64(base64: string, filename: string, mime: string) {
    const bin = atob(base64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    const blob = new Blob([bytes], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  function downloadAcuseFromModal() {
    if (!cancelAcuse) return
    downloadBase64(cancelAcuse.pdf, `Acuse_Cancelacion_${cancelAcuse.uuid.slice(0, 8)}.pdf`, 'application/pdf')
  }

  async function handleDownloadAcuse(inv: FacturapiInvoice) {
    setDownloadingAcuseId(inv.id)
    try {
      const res = await downloadAcuse(inv.id)
      if (res.acusePdfBase64) {
        downloadBase64(res.acusePdfBase64, `Acuse_${inv.series}${inv.folioNumber}.pdf`, 'application/pdf')
      } else {
        toast('El acuse aún no está disponible. El SAT puede tardar unos minutos en procesarlo.', 'info')
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error al descargar acuse', 'error')
    } finally {
      setDownloadingAcuseId(null)
    }
  }

  // Auto-load when switching to facturacion tab or changing month
  const prevMonth = useMemo(() => monthRange.from, [monthRange.from])
  useMemo(() => {
    if (tab === 'facturacion') {
      setInvLoaded(false)
    }
  }, [prevMonth]) // eslint-disable-line

  // Una factura está cancelada si: status=canceled, o cancellationStatus es algo distinto de 'none'/''
  const isCancelled = (inv: FacturapiInvoice) =>
    inv.status === 'canceled' ||
    (inv.cancellationStatus !== 'none' && inv.cancellationStatus !== '')

  const filteredInvoices = useMemo(() => {
    let list = invoices.filter(inv => !isCancelled(inv))
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

  const cancelledInvoices = useMemo(() => {
    return invoices.filter(inv => isCancelled(inv))
  }, [invoices])

  const invSummary = useMemo(() => {
    const active = invoices.filter(inv => !isCancelled(inv))
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
        {tab !== 'facturacion' && tab !== 'promos' && (
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
                    <div className="flex flex-wrap gap-2 text-[10px] text-muted mb-2">
                      <span className="bg-surface2 rounded px-1.5 py-0.5">IVA: {fmt$(inv.iva)}</span>
                      {inv.isr > 0 && <span className="bg-red-500/10 text-red-400 rounded px-1.5 py-0.5">ISR: -{fmt$(inv.isr)}</span>}
                      {inv.ish > 0 && <span className="bg-blue-500/10 text-blue-400 rounded px-1.5 py-0.5">ISH: {fmt$(inv.ish)}</span>}
                      <span className="bg-surface2 rounded px-1.5 py-0.5">{PAYMENT_FORMS[String(inv.paymentForm)] || inv.paymentForm}</span>
                      <span className="bg-surface2 rounded px-1.5 py-0.5 font-mono">{inv.uuid.slice(0, 8)}...</span>
                    </div>
                    <button
                      onClick={() => { setCancelTarget(inv); setCancelMotive('02') }}
                      className="text-[11px] px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 font-medium hover:bg-red-500/20 transition-colors"
                    >
                      ✕ Cancelar factura
                    </button>
                  </motion.div>
                ))}

                {/* ── Facturas Canceladas ── */}
                {cancelledInvoices.length > 0 && (
                  <>
                    <div className="mt-6 mb-3 flex items-center gap-2">
                      <div className="flex-1 border-t border-red-500/20" />
                      <p className="text-xs font-semibold text-red-400 uppercase tracking-wider">
                        Canceladas ({cancelledInvoices.length})
                      </p>
                      <div className="flex-1 border-t border-red-500/20" />
                    </div>
                    {cancelledInvoices.map((inv, i) => (
                      <motion.div
                        key={inv.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: Math.min(i * 0.03, 0.3) }}
                        className="bg-surface border border-red-500/15 rounded-xl p-4 mb-2.5 opacity-75"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <p className="text-xs text-muted">Folio {inv.series}{inv.folioNumber}</p>
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                (inv.cancellationStatus === 'accepted' || inv.status === 'canceled')
                                  ? 'bg-red-500/15 text-red-400'
                                  : 'bg-yellow-500/15 text-yellow-400'
                              }`}>
                                {(inv.cancellationStatus === 'accepted' || inv.status === 'canceled')
                                  ? '❌ Cancelada'
                                  : '⏳ Cancelación pendiente'}
                              </span>
                            </div>
                            <p className="font-bold text-white/60 truncate">{inv.customerRfc}</p>
                            <p className="text-xs text-muted truncate">{inv.customerName}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-red-400/60 font-bold line-through">{fmt$(inv.total)}</p>
                            <p className="text-xs text-muted">{formatDate(inv.date)}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 text-[10px] text-muted mb-2">
                          <span className="bg-surface2 rounded px-1.5 py-0.5 font-mono">{inv.uuid.slice(0, 8)}...</span>
                          <span className="bg-surface2 rounded px-1.5 py-0.5">{PAYMENT_FORMS[String(inv.paymentForm)] || inv.paymentForm}</span>
                        </div>
                        {(inv.cancellationStatus === 'accepted' || inv.status === 'canceled') && (
                          <button
                            onClick={() => handleDownloadAcuse(inv)}
                            disabled={downloadingAcuseId === inv.id}
                            className="text-[11px] px-3 py-1.5 rounded-lg bg-accent/10 text-accent border border-accent/20 font-medium hover:bg-accent/20 transition-colors disabled:opacity-50"
                          >
                            {downloadingAcuseId === inv.id ? '⏳ Descargando...' : '📄 Descargar Acuse de Cancelación'}
                          </button>
                        )}
                        {inv.cancellationStatus === 'pending' && inv.status !== 'canceled' && (
                          <p className="text-[11px] text-yellow-400/70">
                            El SAT está procesando la cancelación. Vuelve después para descargar el acuse.
                          </p>
                        )}
                      </motion.div>
                    ))}
                  </>
                )}
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

        {/* ── Promos ─── */}
        {tab === 'promos' && (
          <>
            <p className="text-xs text-muted mb-4">
              Edita la publicidad cruzada que aparece al cliente después de facturar y en los emails.
            </p>

            {[
              { key: 'mozzafiato' as const, label: 'Cuando factura en Mozzafiato → promueve Casa Regina', state: promoMozz, setter: setPromoMozz, targetId: 'casaregina' as const },
              { key: 'casaregina' as const, label: 'Cuando factura en Casa Regina → promueve Mozzafiato', state: promoRegina, setter: setPromoRegina, targetId: 'mozzafiato' as const },
            ].map(({ key, label, state, setter, targetId }) => {
              const other = NEGOCIOS[targetId]
              const otherLogo = getLogo(other.logoKey)
              return (
                <div key={key} className="mb-6">
                  <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: other.theme.accent }}>{label}</p>

                  {/* Formulario */}
                  <div className="bg-surface border border-white/10 rounded-xl p-4 mb-3 space-y-3">
                    <div>
                      <label className="text-xs text-muted block mb-1">Título</label>
                      <input
                        value={state.headline}
                        onChange={e => setter(prev => ({ ...prev, headline: e.target.value }))}
                        className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                        placeholder="¿Buscas hospedaje...?"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted block mb-1">Descripción</label>
                      <textarea
                        value={state.tagline}
                        onChange={e => setter(prev => ({ ...prev, tagline: e.target.value }))}
                        rows={2}
                        className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm text-white resize-none"
                        placeholder="Texto descriptivo..."
                      />
                    </div>

                    {/* Botones CTA (múltiples) */}
                    <p className="text-xs text-muted font-semibold pt-1">Botones</p>
                    {state.buttons.map((btn, bi) => (
                      <div key={bi} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
                        <div>
                          <label className="text-[10px] text-muted block mb-1">CTA {bi + 1}</label>
                          <input
                            value={btn.cta}
                            onChange={e => {
                              const updated = [...state.buttons]
                              updated[bi] = { ...updated[bi], cta: e.target.value }
                              setter(prev => ({ ...prev, buttons: updated }))
                            }}
                            className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                            placeholder="Texto del botón..."
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted block mb-1">Link</label>
                          <input
                            value={btn.link}
                            onChange={e => {
                              const updated = [...state.buttons]
                              updated[bi] = { ...updated[bi], link: e.target.value }
                              setter(prev => ({ ...prev, buttons: updated }))
                            }}
                            className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                            placeholder="https://..."
                          />
                        </div>
                        {state.buttons.length > 1 && (
                          <button
                            onClick={() => setter(prev => ({ ...prev, buttons: prev.buttons.filter((_, i) => i !== bi) }))}
                            className="px-2 py-2 text-red-400 hover:bg-red-400/10 rounded-lg text-sm"
                            title="Eliminar"
                          >✕</button>
                        )}
                      </div>
                    ))}
                    <button
                      onClick={() => setter(prev => ({ ...prev, buttons: [...prev.buttons, { cta: '', link: '' }] }))}
                      className="text-xs px-3 py-1.5 rounded-lg border border-dashed border-white/20 text-muted hover:text-white hover:border-white/40 transition-colors w-full"
                    >
                      + Agregar otro botón
                    </button>
                  </div>

                  {/* Vista previa */}
                  <p className="text-xs text-muted mb-2">Vista previa:</p>
                  <div
                    className="rounded-xl overflow-hidden border"
                    style={{ borderColor: `${other.theme.accent}40`, background: other.theme.headerBg }}
                  >
                    <div className="p-4 text-center">
                      <img src={otherLogo} alt={other.name} className="h-10 w-auto object-contain mx-auto mb-3" />
                      <p className="text-sm font-bold mb-1" style={{ color: other.theme.headerText }}>
                        {state.headline || 'Título...'}
                      </p>
                      <p className="text-xs leading-relaxed mb-3" style={{ color: `${other.theme.headerText}99` }}>
                        {state.tagline || 'Descripción...'}
                      </p>
                      <div className="flex flex-col gap-2">
                        {state.buttons.map((btn, bi) => (
                          <span
                            key={bi}
                            className="inline-block px-5 py-2 rounded-lg text-sm font-bold"
                            style={bi === 0
                              ? { background: other.theme.accent, color: other.theme.headerBg }
                              : { background: `${other.theme.accent}20`, color: other.theme.accent, border: `1px solid ${other.theme.accent}40` }
                            }
                          >
                            {btn.cta || 'Botón...'} →
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}

            <button
              onClick={handleSavePromos}
              disabled={savingPromos}
              className="btn w-full text-sm font-bold py-3 rounded-xl transition-all"
              style={{ background: savingPromos ? '#555' : '#22c55e', color: '#fff' }}
            >
              {savingPromos ? 'Guardando...' : promoSaved ? '✓ Guardado' : '💾 Guardar promos'}
            </button>
          </>
        )}
      </div>

      {/* Modal cancelar factura */}
      <Modal open={!!cancelTarget} onClose={() => { if (!cancelling) setCancelTarget(null) }} title="Cancelar Factura">
        {cancelTarget && (
          <div className="space-y-3">
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-center">
              <p className="text-red-400 text-sm font-bold">⚠️ Esta acción no se puede deshacer</p>
            </div>
            <DetailRow label="Folio" value={`${cancelTarget.series}${cancelTarget.folioNumber}`} />
            <DetailRow label="RFC" value={cancelTarget.customerRfc} />
            <DetailRow label="Razón Social" value={cancelTarget.customerName} />
            <DetailRow label="Total" value={fmt$(cancelTarget.total)} />
            <DetailRow label="UUID" value={cancelTarget.uuid} />

            <div className="pt-2">
              <label className="text-xs text-muted block mb-1.5">Motivo de cancelación (SAT)</label>
              <select
                value={cancelMotive}
                onChange={e => setCancelMotive(e.target.value)}
                className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
              >
                <option value="01">01 — Con relación (sustituir por otra)</option>
                <option value="02">02 — Con errores sin relación</option>
                <option value="03">03 — No se llevó a cabo la operación</option>
                <option value="04">04 — Operación nominativa relacionada</option>
              </select>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleCancelInvoice}
                disabled={cancelling}
                className="btn flex-1 bg-red-500/20 text-red-400 border border-red-500/30 font-bold text-sm disabled:opacity-50"
              >
                {cancelling ? 'Cancelando...' : '✕ Confirmar Cancelación'}
              </button>
              <button
                onClick={() => setCancelTarget(null)}
                disabled={cancelling}
                className="btn flex-1 bg-surface2 text-muted border border-white/10 text-sm"
              >
                Regresar
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal acuse de cancelación */}
      <Modal open={!!cancelAcuse} onClose={() => setCancelAcuse(null)} title="Acuse de Cancelación">
        {cancelAcuse && (
          <div className="space-y-4 text-center">
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
              <p className="text-emerald-400 text-lg font-bold mb-1">✅ Factura cancelada</p>
              <p className="text-muted text-xs">UUID: {cancelAcuse.uuid}</p>
            </div>
            {cancelAcuse.pdf && (
              <button
                onClick={downloadAcuseFromModal}
                className="btn w-full bg-accent/20 text-accent border border-accent/30 font-bold text-sm py-3"
              >
                📄 Descargar Acuse de Cancelación (PDF)
              </button>
            )}
            <button
              onClick={() => setCancelAcuse(null)}
              className="btn w-full bg-surface2 text-muted border border-white/10 text-sm"
            >
              Cerrar
            </button>
          </div>
        )}
      </Modal>

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
