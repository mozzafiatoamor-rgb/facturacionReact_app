// ============================================================
// LLEVARPAGE.TSX — Formulario público "para llevar"
// El cliente accede via link de WhatsApp (sin login)
// Muestra branding del negocio correcto (Mozzafiato / Casa Regina)
// ============================================================

import { useState, useMemo, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getLogo } from '../assets/logos'
import { getNegocio } from '../config/businesses'
import { REGIMENES, USOS_CFDI, QUERY_KEYS, STALE_TIMES, SHEET_NAMES } from '../api/config'
import { fetchClientes, fetchSolicitudes } from '../api/sheets'
import { batchAppend, timbrarFactura, updateStatus, cleanupFailed } from '../api/appscript'
import type { TimbradoResult } from '../api/appscript'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { generateId } from '../utils/ids'
import { now, fmt$ } from '../utils/dates'
import type { LlevarData } from '../utils/llevar'
import type { Cliente, Solicitud, BatchItem } from '../api/types'

function fullRegimen(clave: string): string {
  const r = REGIMENES.find((x) => x.clave === clave || clave.startsWith(x.clave))
  return r ? `${r.clave} - ${r.desc}` : clave
}
function fullUsoCfdi(clave: string): string {
  const u = USOS_CFDI.find((x) => x.clave === clave || clave.startsWith(x.clave))
  return u ? `${u.clave} - ${u.desc}` : clave
}

const SUCCESS_MESSAGES = [
  '¡Factura generada con éxito!',
  '¡Excelente! Tu factura está lista.',
  '¡Listo! Tu factura fue timbrada correctamente.',
  '¡Perfecto! Ya puedes descargar tu factura.',
  '¡Genial! Factura timbrada al instante.',
  '¡Todo en orden! Revisa tu correo para la factura.',
  '¡Hecho! Gracias por tu preferencia.',
  '¡Tu factura va volando! Gracias por elegirnos.',
  '¡Misión cumplida! Tu factura también se envió a tu correo.',
  '¡Así de fácil! Tu factura ya está lista para descargar.',
]

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  Pendiente:  { color: 'text-yellow-400', bg: 'bg-yellow-400/10 border-yellow-400/30', label: '⏳ Pendiente' },
  Procesada:  { color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/30', label: '✅ Procesada' },
  Cancelada:  { color: 'text-red-400', bg: 'bg-red-400/10 border-red-400/30', label: '❌ Cancelada' },
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastErr: unknown
  for (let i = 0; i < maxRetries; i++) {
    try { return await fn() } catch (e) {
      lastErr = e
      if (i < maxRetries - 1) await new Promise((r) => setTimeout(r, 1000 * (i + 1)))
    }
  }
  throw lastErr
}

function buildNotifyWaUrl(waNumber: string, negocioName: string, solId: string, rfc: string, monto: string, mesa: string, email: string): string {
  const msg = encodeURIComponent(
    `🧾 *Solicitud de Factura — ${negocioName}*\n\n` +
    `Hola, acabo de solicitar mi factura desde el link.\n\n` +
    `📋 *Datos:*\n` +
    `• ID: ${solId}\n` +
    `• RFC: ${rfc}\n` +
    `• Monto: $${monto}\n` +
    `• ${negocioName === 'Casa Regina' ? 'Hab' : 'Mesa'}: ${mesa}\n` +
    `• Email: ${email}\n\n` +
    `¿Podrían confirmar que la recibieron? Gracias.`
  )
  return `https://wa.me/${waNumber}?text=${msg}`
}

interface LlevarPageProps {
  data: LlevarData
}

export function LlevarPage({ data }: LlevarPageProps) {
  const queryClient = useQueryClient()
  const neg = getNegocio(data.negocio)
  const logo = getLogo(neg.logoKey)

  const { data: clientes = [] } = useQuery({
    queryKey: QUERY_KEYS.clientes,
    queryFn: fetchClientes,
    staleTime: STALE_TIMES.clientes,
  })

  const { data: solicitudes = [], isLoading: loadingSols } = useQuery({
    queryKey: QUERY_KEYS.solicitudes,
    queryFn: fetchSolicitudes,
    staleTime: 10_000,
  })

  const existing: Solicitud | null = useMemo(() => {
    return solicitudes.find((s) =>
      s.mesa === data.mesa &&
      s.monto === data.monto &&
      s.fecha === data.fecha &&
      s.mesero === data.mesero
    ) ?? null
  }, [solicitudes, data])

  const [rfcInput,  setRfcInput ] = useState('')
  const [selected,  setSelected ] = useState<Cliente | null>(null)
  const [isNew,     setIsNew    ] = useState(false)
  const [form, setForm] = useState({
    rfc: '', razonSocial: '', regimen: '626', usoCfdi: 'G03',
    email: '', codigoPostal: '', telefono: '', comentarios: '',
  })
  const [errors,    setErrors   ] = useState<Record<string, string>>({})
  const [sending,   setSending  ] = useState(false)
  const [sendError, setSendError] = useState('')
  const [done,      setDone     ] = useState(false)
  const [savedSolId, setSavedSolId] = useState('')
  const [msgIdx,    setMsgIdx   ] = useState(() => Math.floor(Math.random() * SUCCESS_MESSAGES.length))
  const [confirming, setConfirming] = useState(false)
  const [timbrado,  setTimbrado ] = useState<TimbradoResult | null>(null)
  const [timbrando, setTimbrando] = useState(false)
  const [timbradoError, setTimbradoError] = useState('')
  const retryRef = useRef<{ items: BatchItem[]; solId: string } | null>(null)

  useEffect(() => {
    if (!done) return
    const t = setInterval(() => setMsgIdx(Math.floor(Math.random() * SUCCESS_MESSAGES.length)), 3000)
    return () => clearInterval(t)
  }, [done])

  const suggestions = useMemo(() => {
    const q = rfcInput.trim().toUpperCase()
    if (q.length < 2) return []
    return clientes
      .filter((c) => c.rfc.includes(q) || c.razonSocial.toUpperCase().includes(q))
      .slice(0, 6)
  }, [rfcInput, clientes])

  const noResults = rfcInput.trim().length >= 3 && suggestions.length === 0

  function pickCliente(c: Cliente) {
    setSelected(c)
    setIsNew(false)
    setForm({
      rfc: c.rfc, razonSocial: c.razonSocial, regimen: c.regimen,
      usoCfdi: c.usoCfdi, email: c.email, codigoPostal: c.codigoPostal,
      telefono: c.telefono, comentarios: '',
    })
  }

  function useAsNew() {
    setSelected(null)
    setIsNew(true)
    setForm((f) => ({ ...f, rfc: rfcInput.trim().toUpperCase() }))
  }

  function set(key: string, val: string) {
    setForm((f) => ({ ...f, [key]: val }))
    setErrors((e) => ({ ...e, [key]: '' }))
  }

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!form.rfc.trim()) e.rfc = 'RFC requerido'
    if (!form.razonSocial.trim()) e.razonSocial = 'Razón social requerida'
    if (!form.regimen) e.regimen = 'Régimen requerido'
    if (!form.usoCfdi) e.usoCfdi = 'Uso CFDI requerido'
    if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      e.email = 'Email válido requerido'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handlePreSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    if (!validate()) return
    setConfirming(true)
  }

  async function handleConfirmSubmit() {
    setSending(true)
    setSendError('')

    const { date, time } = now()
    const solId = generateId(neg.folioPrefix)
    const regimenStr = fullRegimen(form.regimen)
    const cfdiStr = fullUsoCfdi(form.usoCfdi)
    const rfc = form.rfc.toUpperCase()

    const items: BatchItem[] = []

    items.push({
      sheet: SHEET_NAMES.solicitudes,
      rows: [[
        solId, date, time, data.mesa, data.monto, data.tipoPago,
        rfc, form.razonSocial, regimenStr, cfdiStr,
        form.email, 'Pendiente', data.mesero, 'Solicitud via link para llevar',
        form.codigoPostal, data.negocio,
      ]],
    })

    if (isNew) {
      items.push({
        sheet: SHEET_NAMES.clientes,
        rows: [[
          generateId('CLI'), rfc, form.razonSocial, regimenStr, cfdiStr,
          form.email, date, form.telefono, form.codigoPostal,
        ]],
      })
    }

    items.push({
      sheet: SHEET_NAMES.bitacora,
      rows: [[date, time, data.mesero, 'Solicitud (llevar)', `${rfc} Mesa ${data.mesa} [${neg.name}]`, 'solicitud']],
    })

    retryRef.current = { items, solId }

    try {
      await withRetry(() => batchAppend(items), 3)
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.solicitudes })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.clientes })
      setSavedSolId(solId)
      setSending(false)
      setDone(true)
      try { navigator.vibrate?.([50, 30, 80]) } catch { /* */ }

      // Intentar timbrado automático (no bloquea el éxito)
      try {
        setTimbrando(true)
        setTimbradoError('')
        const result = await timbrarFactura({
          rfc, razonSocial: form.razonSocial, regimen: regimenStr, usoCfdi: cfdiStr,
          email: form.email, codigoPostal: form.codigoPostal, telefono: form.telefono,
          monto: data.monto, tipoPago: data.tipoPago, negocio: data.negocio,
          folioPrefix: neg.folioPrefix, mesa: data.mesa, mesero: data.mesero,
          comentarios: form.comentarios || undefined,
        })
        if (result.success) {
          setTimbrado(result)
          // Marcar como Procesada en Sheets
          try { await updateStatus(solId, 'Procesada', `Timbrada auto — UUID: ${result.uuid}`) } catch { /* */ }
          queryClient.invalidateQueries({ queryKey: QUERY_KEYS.solicitudes })
        } else {
          setTimbradoError(result.error || 'Error desconocido al timbrar')
        }
      } catch (err) {
        setTimbradoError(err instanceof Error ? err.message : 'Error de conexión al timbrar')
      } finally { setTimbrando(false) }
    } catch {
      setSendError('No se pudo enviar tu solicitud. Verifica tu conexión a internet e intenta de nuevo.')
      setSending(false)
    }
  }

  async function handleRetry() {
    if (!retryRef.current) return
    setSending(true)
    setSendError('')
    const { items, solId } = retryRef.current
    try {
      await withRetry(() => batchAppend(items), 3)
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.solicitudes })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.clientes })
      setSavedSolId(solId)
      setDone(true)
    } catch {
      setSendError('Sigue sin poder conectar. Envía un WhatsApp para que te ayuden.')
    } finally {
      setSending(false)
    }
  }

  const [cleaning, setCleaning] = useState(false)

  async function handleCorregir() {
    setCleaning(true)
    try {
      await cleanupFailed(savedSolId, form.rfc.toUpperCase(), isNew)
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.solicitudes })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.clientes })
    } catch { /* best effort */ }
    // Reset estado al formulario
    setDone(false)
    setConfirming(false)
    setTimbrado(null)
    setTimbradoError('')
    setSavedSolId('')
    setSendError('')
    retryRef.current = null
    setCleaning(false)
  }

  function openNotifyWa() {
    const id = savedSolId || retryRef.current?.solId || '—'
    const url = buildNotifyWaUrl(neg.waNumber, neg.name, id, form.rfc.toUpperCase(), data.monto, data.mesa, form.email)
    window.open(url, '_blank')
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

  const t = neg.theme

  // ── Loading ────────────────────────────────────────────────
  if (loadingSols) {
    return (
      <div className="h-dvh bg-bg flex flex-col items-center justify-center px-6">
        <img src={logo} alt={neg.name} className="h-16 w-auto object-contain mb-4" />
        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: t.accent, borderTopColor: 'transparent' }} />
        <p className="text-muted text-sm mt-3">Cargando...</p>
      </div>
    )
  }

  // ── ESTATUS ────────────────────────────────────────────────
  if (existing && !done) {
    const cfg = STATUS_CONFIG[existing.status] ?? STATUS_CONFIG.Pendiente
    return (
      <div className="h-dvh bg-bg flex flex-col overflow-hidden">
        <header className="border-b border-white/10 px-4 py-3 flex items-center gap-3" style={{ background: t.headerBg }}>
          <img src={logo} alt={neg.name} className="h-7 w-auto object-contain flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: t.headerText }}>Estatus de Factura</p>
            <p className="text-xs truncate" style={{ color: `${t.accent}99` }}>{neg.name}</p>
          </div>
        </header>

        <div className="flex-1 px-4 pt-6 pb-8 max-w-sm mx-auto w-full overflow-y-auto">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-5">
            <p className="text-lg font-bold text-white">¡Hola de nuevo! 👋</p>
            <p className="text-sm text-muted mt-1">Tu solicitud de factura ya fue registrada.</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.05 }}
            className={`border rounded-xl p-5 text-center mb-6 ${cfg.bg}`}>
            <p className="text-3xl mb-2">{cfg.label.split(' ')[0]}</p>
            <p className={`text-xl font-bold ${cfg.color}`}>{cfg.label.split(' ').slice(1).join(' ')}</p>
            <p className="text-muted text-xs mt-2">ID: {existing.id}</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="bg-surface border border-white/10 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: t.accent }}>Detalles</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Detail label={neg.labelMesa} value={existing.mesa} />
              <Detail label="Monto" value={fmt$(existing.monto)} />
              <Detail label="Tipo de pago" value={existing.tipoPago} />
              <Detail label="Fecha" value={existing.fecha} />
              <Detail label="Hora" value={existing.hora} />
              <Detail label={neg.labelMesero} value={existing.mesero} />
            </div>
            <div className="border-t border-white/10 pt-3 space-y-2">
              <Detail label="RFC" value={existing.rfc} />
              <Detail label="Razón Social" value={existing.razonSocial} />
              <Detail label="Email" value={existing.email} />
            </div>
          </motion.div>

          {neg.waNumber && (
            <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}
              onClick={() => {
                const url = buildNotifyWaUrl(neg.waNumber, neg.name, existing.id, existing.rfc, existing.monto, existing.mesa, existing.email)
                window.open(url, '_blank')
              }}
              className="btn w-full mt-4 text-sm font-bold"
              style={{ background: '#25D366', color: '#fff' }}>
              💬 Contactar a {neg.name} por WhatsApp
            </motion.button>
          )}
        </div>
      </div>
    )
  }

  // ── ÉXITO ──────────────────────────────────────────────────
  if (done) {
    return (
      <div className="h-dvh bg-bg flex flex-col items-center justify-center px-6 text-center overflow-hidden relative">
        {[...Array(6)].map((_, i) => (
          <motion.div key={i} className="absolute w-2 h-2 rounded-full" style={{ background: `${t.accent}33` }}
            initial={{ opacity: 0, y: 100, x: (i - 3) * 60 }}
            animate={{ opacity: [0, 0.6, 0], y: [100, -200], x: (i - 3) * 60 + Math.sin(i) * 30 }}
            transition={{ duration: 3, repeat: Infinity, delay: i * 0.5, ease: 'easeOut' }}
          />
        ))}
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 16 }} className="mb-4">
          <img src={logo} alt={neg.name} className="h-24 w-auto object-contain drop-shadow-xl mx-auto" />
        </motion.div>
        <motion.div initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', damping: 16, delay: 0.15 }} className="text-6xl mb-4">
          {timbrado ? '🧾' : timbradoError ? '⚠️' : '✅'}
        </motion.div>

        {/* Timbrando... */}
        {timbrando && !timbrado && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-4">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-2" style={{ borderColor: t.accent, borderTopColor: 'transparent' }} />
            <p className="text-sm font-medium" style={{ color: t.accent }}>Timbrando tu factura...</p>
            <p className="text-muted text-xs mt-1">Esto puede tomar unos segundos</p>
          </motion.div>
        )}

        {/* Timbrado exitoso — descarga PDF/XML */}
        {timbrado && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-4 w-full max-w-[300px]">
            <p className="text-lg font-bold text-success mb-1">¡Factura timbrada!</p>
            <p className="text-muted text-xs mb-3">UUID: {timbrado.uuid?.slice(0, 8)}...</p>
            <div className="flex gap-2">
              <button
                onClick={() => downloadBase64(timbrado.pdfBase64, `Factura_${timbrado.folioNumber}.pdf`, 'application/pdf')}
                className="btn flex-1 bg-red-500/20 text-red-400 border border-red-500/30 text-sm font-bold">
                📄 Descargar PDF
              </button>
              <button
                onClick={() => downloadBase64(timbrado.xmlBase64, `Factura_${timbrado.folioNumber}.xml`, 'application/xml')}
                className="btn flex-1 bg-blue-500/20 text-blue-400 border border-blue-500/30 text-sm font-bold">
                📋 Descargar XML
              </button>
            </div>
            <p className="text-muted text-xs mt-2">También se envió a {form.email}</p>
          </motion.div>
        )}

        {/* Error de timbrado */}
        {timbradoError && !timbrado && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 mb-4 w-full max-w-[300px]">
            <p className="text-red-400 text-xs font-medium mb-1">No se pudo generar tu factura:</p>
            <p className="text-red-300 text-xs break-all mb-3">{timbradoError}</p>
            <button
              onClick={handleCorregir}
              disabled={cleaning}
              className="btn w-full text-sm font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
              {cleaning ? 'Limpiando...' : '✏️ Corregir datos y reintentar'}
            </button>
            <p className="text-muted text-xs mt-2 text-center">
              O contacta al restaurante para que el despacho lo procese.
            </p>
          </motion.div>
        )}

        {/* Mensaje de éxito rotativo (solo si no timbró y sin error) */}
        {!timbrado && !timbrando && !timbradoError && (
          <>
            <AnimatePresence mode="wait">
              <motion.p key={msgIdx}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.35 }}
                className="text-lg font-bold text-success mb-4 leading-snug max-w-[280px] mx-auto">
                {SUCCESS_MESSAGES[msgIdx]}
              </motion.p>
            </AnimatePresence>
            <div className="bg-surface/60 border border-white/10 rounded-xl px-4 py-3 backdrop-blur-sm mb-4">
              <p className="text-white text-sm font-medium">{neg.labelMesa} {data.mesa} · {fmt$(data.monto)}</p>
              <p className="text-muted text-xs mt-1">Se enviará confirmación a {form.email}</p>
            </div>
          </>
        )}

        {/* Mensaje cuando hay error de timbrado */}
        {timbradoError && !timbrado && !timbrando && (
          <div className="bg-surface/60 border border-white/10 rounded-xl px-4 py-3 backdrop-blur-sm mb-4">
            <p className="text-white text-sm font-medium">Solicitud registrada · {neg.labelMesa} {data.mesa} · {fmt$(data.monto)}</p>
            <p className="text-muted text-xs mt-1">Nuestro equipo generará tu factura y la enviará a {form.email}</p>
          </div>
        )}

        {neg.waNumber && (
          <>
            <motion.button initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              onClick={openNotifyWa}
              className="btn w-full max-w-[280px] text-sm font-bold"
              style={{ background: '#25D366', color: '#fff' }}>
              💬 Notificar a {neg.name} por WhatsApp
            </motion.button>
            <p className="text-muted text-xs mt-2 max-w-[260px]">
              Opcional: avísanos por WhatsApp para confirmar tu solicitud
            </p>
          </>
        )}
      </div>
    )
  }

  // ── FORMULARIO ─────────────────────────────────────────────
  return (
    <div className="h-dvh bg-bg flex flex-col overflow-hidden" style={{ '--neg-accent': t.accent } as React.CSSProperties}>
      <header className="border-b border-white/10 px-4 py-3 flex items-center gap-3" style={{ background: t.headerBg }}>
        <img src={logo} alt={neg.name} className="h-7 w-auto object-contain flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: t.headerText }}>Generar Factura</p>
          <p className="text-xs truncate" style={{ color: `${t.accent}99` }}>{neg.name}</p>
        </div>
      </header>

      <div className="flex-1 px-4 pt-4 pb-8 max-w-sm mx-auto w-full overflow-y-auto">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-4">
          <p className="text-lg font-bold text-white">¡Hola! 👋 Gracias por tu visita</p>
          <p className="text-sm text-muted mt-1 leading-relaxed">
            Solicita tu factura en 3 sencillos pasos: busca tu RFC, confirma tus datos fiscales y listo.
          </p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="rounded-xl p-4 mb-5" style={{ background: t.accentLight, border: `1px solid ${t.accent}4D` }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: t.accent }}>Datos del pedido</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="text-muted">{neg.labelMesa}:</span> <span className="text-white font-bold">{data.mesa}</span></div>
            <div><span className="text-muted">Monto:</span> <span className="text-white font-bold">{fmt$(data.monto)}</span></div>
            <div><span className="text-muted">Pago:</span> <span className="text-white">{data.tipoPago}</span></div>
            <div><span className="text-muted">Fecha:</span> <span className="text-white">{data.fecha}</span></div>
          </div>
          <p className="text-xs text-muted mt-2">{neg.labelMesero}: {data.mesero}</p>
        </motion.div>

        {sendError && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4 text-center">
            <p className="text-red-400 text-sm font-medium mb-3">{sendError}</p>
            <div className="flex gap-2">
              <button onClick={handleRetry} disabled={sending}
                className="btn flex-1 text-white text-sm font-bold disabled:opacity-50" style={{ background: t.accent }}>
                {sending ? 'Reintentando...' : '🔄 Reintentar'}
              </button>
              {neg.waNumber && (
                <button onClick={openNotifyWa}
                  className="btn flex-1 text-sm font-bold"
                  style={{ background: '#25D366', color: '#fff' }}>
                  💬 WhatsApp
                </button>
              )}
            </div>
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {!selected && !isNew && (
            <motion.div key="buscar" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <div className="text-center mb-4">
                <h2 className="text-lg font-bold text-white">Buscar tu RFC</h2>
                <p className="text-xs text-muted mt-1">Si ya nos visitaste antes, búscalo aquí</p>
              </div>
              <div className="bg-surface border border-white/10 rounded-xl p-4">
                <label className="block text-xs text-muted font-medium mb-1.5">RFC o Razón Social</label>
                <input value={rfcInput} onChange={(e) => setRfcInput(e.target.value)}
                  placeholder="Escribe tu RFC..." autoCapitalize="characters" spellCheck={false} className="input w-full" />

                {suggestions.length > 0 && (
                  <div className="rounded-lg mt-2 max-h-48 overflow-y-auto" style={{ border: `1px solid ${t.accent}4D` }}>
                    {suggestions.map((c) => (
                      <button key={c.id} type="button" onClick={() => pickCliente(c)}
                        className="w-full text-left px-3 py-2.5 border-b border-white/5 last:border-0 hover:bg-surface2">
                        <span className="block font-bold text-white text-sm">{c.rfc}</span>
                        <span className="block text-xs text-muted">{c.razonSocial}</span>
                      </button>
                    ))}
                  </div>
                )}

                {noResults && (
                  <button onClick={useAsNew}
                    className="btn w-full bg-surface2 border border-white/10 text-white mt-3 text-sm">
                    + Usar "{rfcInput.toUpperCase()}" como nuevo RFC
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {(selected || isNew) && !confirming && (
            <motion.div key="form" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-white">Datos Fiscales</h2>
                  <p className="text-xs text-muted mt-0.5">{isNew ? 'Nuevo cliente' : 'Confirma tus datos'}</p>
                </div>
                <button onClick={() => { setSelected(null); setIsNew(false); setRfcInput('') }}
                  className="text-xs" style={{ color: t.accent }}>← Cambiar RFC</button>
              </div>

              <form onSubmit={handlePreSubmit} className="bg-surface border border-white/10 rounded-xl p-4 space-y-3">
                <Field label="RFC" error={errors.rfc}>
                  <input value={form.rfc} onChange={(e) => set('rfc', e.target.value)}
                    placeholder="XAXX010101000" autoCapitalize="characters" spellCheck={false} className="input" />
                </Field>
                <Field label="Razón Social / Nombre" error={errors.razonSocial}>
                  <input value={form.razonSocial} onChange={(e) => set('razonSocial', e.target.value)}
                    placeholder="Empresa SA de CV" className="input" />
                </Field>
                <Field label="Régimen Fiscal" error={errors.regimen}>
                  <select value={form.regimen} onChange={(e) => set('regimen', e.target.value)} className="input">
                    <option value="">Seleccionar...</option>
                    {REGIMENES.map((r) => (<option key={r.clave} value={r.clave}>{r.clave} - {r.desc}</option>))}
                  </select>
                </Field>
                <Field label="Uso CFDI" error={errors.usoCfdi}>
                  <select value={form.usoCfdi} onChange={(e) => set('usoCfdi', e.target.value)} className="input">
                    <option value="">Seleccionar...</option>
                    {USOS_CFDI.map((u) => (<option key={u.clave} value={u.clave}>{u.clave} - {u.desc}</option>))}
                  </select>
                </Field>
                <Field label="Email (para tu factura)" error={errors.email}>
                  <input value={form.email} onChange={(e) => set('email', e.target.value)}
                    type="email" inputMode="email" placeholder="tu@email.com" className="input" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="C.P." error={errors.codigoPostal}>
                    <input value={form.codigoPostal} onChange={(e) => set('codigoPostal', e.target.value)}
                      inputMode="numeric" placeholder="64000" className="input" />
                  </Field>
                  <Field label="Teléfono" error={errors.telefono}>
                    <input value={form.telefono} onChange={(e) => set('telefono', e.target.value)}
                      type="tel" inputMode="tel" placeholder="81 0000 0000" className="input" />
                  </Field>
                </div>
                <Field label="Comentarios / Observaciones (opcional)" error={errors.comentarios}>
                  <textarea value={form.comentarios} onChange={(e) => set('comentarios', e.target.value)}
                    placeholder="Ej: Núm. de orden, departamento, notas especiales..."
                    rows={2} className="input resize-none" />
                </Field>
                <button type="submit"
                  className="btn w-full mt-2 text-white" style={{ background: t.accent }}>
                  Revisar y Generar →
                </button>
              </form>
            </motion.div>
          )}

          {confirming && (
            <motion.div key="confirm" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-white">Confirmar Datos</h2>
                  <p className="text-xs text-muted mt-0.5">Revisa que todo esté correcto antes de facturar</p>
                </div>
                <button onClick={() => setConfirming(false)}
                  className="text-xs" style={{ color: t.accent }}>← Editar datos</button>
              </div>

              <div className="rounded-xl p-4 mb-4" style={{ background: '#fbbf241A', border: '1px solid #fbbf244D' }}>
                <p className="text-sm font-medium" style={{ color: '#fbbf24' }}>
                  Verifica tus datos antes de generar la factura. Una vez timbrada no se puede modificar.
                </p>
              </div>

              <div className="bg-surface border border-white/10 rounded-xl p-4 space-y-3 mb-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted">RFC</p>
                    <p className="text-white font-bold">{form.rfc.toUpperCase()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Monto</p>
                    <p className="text-white font-bold">{fmt$(data.monto)}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-muted">Razón Social</p>
                    <p className="text-white font-medium">{form.razonSocial}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-muted">Régimen Fiscal</p>
                    <p className="text-white text-sm">{fullRegimen(form.regimen)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Uso CFDI</p>
                    <p className="text-white text-sm">{fullUsoCfdi(form.usoCfdi)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">C.P.</p>
                    <p className="text-white">{form.codigoPostal || '—'}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-muted">Email</p>
                    <p className="text-white">{form.email}</p>
                  </div>
                  {form.comentarios && (
                    <div className="col-span-2">
                      <p className="text-xs text-muted">Comentarios</p>
                      <p className="text-white text-sm">{form.comentarios}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button onClick={handleConfirmSubmit} disabled={sending}
                  className="btn w-full text-white font-bold disabled:opacity-50" style={{ background: t.accent }}>
                  {sending ? 'Generando factura...' : '🧾 Confirmar y Generar Factura'}
                </button>
                <button onClick={() => setConfirming(false)} disabled={sending}
                  className="btn w-full bg-surface2 border border-white/10 text-muted text-sm">
                  ← Regresar a editar
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-muted font-medium mb-1.5">{label}</label>
      {children}
      {error && <p className="text-xs text-danger mt-1">{error}</p>}
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="text-sm text-white font-medium">{value || '—'}</p>
    </div>
  )
}
