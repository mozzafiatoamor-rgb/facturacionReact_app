// ============================================================
// LLEVARPAGE.TSX — Formulario público "para llevar"
// El cliente accede via link de WhatsApp (sin login)
// Si ya solicitó factura → muestra estatus
// Si no → muestra formulario fiscal
// Refuerzo: 3 reintentos + verificación + WhatsApp a Mozzafiato
// ============================================================

import { useState, useMemo, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { LOGO } from '../assets/logo'
import { REGIMENES, USOS_CFDI, QUERY_KEYS, STALE_TIMES, SHEET_NAMES } from '../api/config'
import { fetchClientes, fetchSolicitudes } from '../api/sheets'
import { batchAppend, sendConfirmation } from '../api/appscript'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { generateId } from '../utils/ids'
import { now, fmt$ } from '../utils/dates'
import type { LlevarData } from '../utils/llevar'
import type { Cliente, Solicitud, BatchItem, EmailData } from '../api/types'

const MOZZAFIATO_WA = '529984088897'

function fullRegimen(clave: string): string {
  const r = REGIMENES.find((x) => x.clave === clave || clave.startsWith(x.clave))
  return r ? `${r.clave} - ${r.desc}` : clave
}
function fullUsoCfdi(clave: string): string {
  const u = USOS_CFDI.find((x) => x.clave === clave || clave.startsWith(x.clave))
  return u ? `${u.clave} - ${u.desc}` : clave
}

const SUCCESS_MESSAGES = [
  '¡Solicitud enviada con éxito! Tu factura está en camino.',
  '¡Excelente! Pronto recibirás tu factura por correo.',
  '¡Listo! Tu solicitud fue registrada correctamente.',
  '¡Perfecto! El equipo contable ya tiene tu solicitud.',
  '¡Genial! Tu factura será procesada a la brevedad.',
  '¡Todo en orden! Revisa tu correo para la confirmación.',
  '¡Hecho! Gracias por tu preferencia en Mozzafiato.',
  '¡Tu factura va volando! Gracias por elegirnos.',
  '¡Misión cumplida! Tu factura llegará pronto a tu correo.',
  '¡Así de fácil! Disfruta mientras preparamos tu factura.',
]

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  Pendiente:  { color: 'text-yellow-400', bg: 'bg-yellow-400/10 border-yellow-400/30', label: '⏳ Pendiente' },
  Procesada:  { color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/30', label: '✅ Procesada' },
  Cancelada:  { color: 'text-red-400', bg: 'bg-red-400/10 border-red-400/30', label: '❌ Cancelada' },
}

// ── Reintento con delay exponencial ──────────────────────────
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastErr: unknown
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (e) {
      lastErr = e
      if (i < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, 1000 * (i + 1)))
      }
    }
  }
  throw lastErr
}

// ── Generar link de WhatsApp a Mozzafiato ────────────────────
function buildNotifyWaUrl(solId: string, rfc: string, monto: string, mesa: string, email: string): string {
  const msg = encodeURIComponent(
    `🧾 *Solicitud de Factura*\n\n` +
    `Hola, acabo de solicitar mi factura desde el link para llevar.\n\n` +
    `📋 *Datos:*\n` +
    `• ID: ${solId}\n` +
    `• RFC: ${rfc}\n` +
    `• Monto: $${monto}\n` +
    `• Mesa: ${mesa}\n` +
    `• Email: ${email}\n\n` +
    `¿Podrían confirmar que la recibieron? Gracias.`
  )
  return `https://wa.me/${MOZZAFIATO_WA}?text=${msg}`
}

interface LlevarPageProps {
  data: LlevarData
}

export function LlevarPage({ data }: LlevarPageProps) {
  const queryClient = useQueryClient()

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

  // Estado del formulario
  const [rfcInput,  setRfcInput ] = useState('')
  const [selected,  setSelected ] = useState<Cliente | null>(null)
  const [isNew,     setIsNew    ] = useState(false)
  const [form, setForm] = useState({
    rfc: '', razonSocial: '', regimen: '626', usoCfdi: 'G03',
    email: '', codigoPostal: '', telefono: '',
  })
  const [errors,    setErrors   ] = useState<Record<string, string>>({})
  const [sending,   setSending  ] = useState(false)
  const [sendError, setSendError] = useState('')
  const [done,      setDone     ] = useState(false)
  const [savedSolId, setSavedSolId] = useState('')
  const [msgIdx,    setMsgIdx   ] = useState(() => Math.floor(Math.random() * SUCCESS_MESSAGES.length))
  const retryRef = useRef<{ items: BatchItem[]; emailData: EmailData; solId: string } | null>(null)

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
      telefono: c.telefono,
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

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    if (!validate()) return
    setSending(true)
    setSendError('')

    const { date, time } = now()
    const solId = generateId('SOL')
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
        form.codigoPostal,
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
      rows: [[date, time, data.mesero, 'Solicitud (llevar)', `${rfc} Mesa ${data.mesa}`, 'solicitud']],
    })

    const emailData: EmailData = {
      id: solId, fecha: date, hora: time, mesa: data.mesa,
      monto: data.monto, tipoPago: data.tipoPago, rfc,
      razonSocial: form.razonSocial, regimen: regimenStr,
      usoCfdi: cfdiStr, email: form.email, status: 'Pendiente',
      mesero: data.mesero,
    }

    // Guardar para posible reintento manual
    retryRef.current = { items, emailData, solId }

    try {
      // Intento con 3 reintentos automáticos
      await withRetry(() => batchAppend(items, emailData), 3)

      // Email de confirmación (no bloquea éxito)
      try { await sendConfirmation(solId, emailData) } catch { /* silencioso */ }

      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.solicitudes })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.clientes })
      setSavedSolId(solId)
      setDone(true)
      try { navigator.vibrate?.([50, 30, 80]) } catch { /* */ }
    } catch {
      setSendError(
        'No se pudo enviar tu solicitud. Verifica tu conexión a internet e intenta de nuevo.'
      )
    } finally {
      setSending(false)
    }
  }

  async function handleRetry() {
    if (!retryRef.current) return
    setSending(true)
    setSendError('')

    const { items, emailData, solId } = retryRef.current

    try {
      await withRetry(() => batchAppend(items, emailData), 3)
      try { await sendConfirmation(solId, emailData) } catch { /* */ }

      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.solicitudes })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.clientes })
      setSavedSolId(solId)
      setDone(true)
      try { navigator.vibrate?.([50, 30, 80]) } catch { /* */ }
    } catch {
      setSendError(
        'Sigue sin poder conectar. Envía un WhatsApp a Mozzafiato para que te ayuden.'
      )
    } finally {
      setSending(false)
    }
  }

  function openMozzafiatoWa() {
    const id = savedSolId || retryRef.current?.solId || '—'
    const url = buildNotifyWaUrl(id, form.rfc.toUpperCase(), data.monto, data.mesa, form.email)
    window.open(url, '_blank')
  }

  // ── Loading ────────────────────────────────────────────────
  if (loadingSols) {
    return (
      <div className="h-dvh bg-bg flex flex-col items-center justify-center px-6">
        <img src={LOGO} alt="Logo" className="h-16 w-auto object-contain mb-4" />
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        <p className="text-muted text-sm mt-3">Cargando...</p>
      </div>
    )
  }

  // ── ESTATUS (ya solicitó factura) ──────────────────────────
  if (existing && !done) {
    const cfg = STATUS_CONFIG[existing.status] ?? STATUS_CONFIG.Pendiente
    return (
      <div className="h-dvh bg-bg flex flex-col overflow-hidden">
        <header className="bg-surface border-b border-white/10 px-4 py-3 flex items-center gap-3">
          <img src={LOGO} alt="Logo" className="h-7 w-auto object-contain flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">Estatus de Factura</p>
            <p className="text-xs text-muted truncate">Mozzafiato</p>
          </div>
        </header>

        <div className="flex-1 px-4 pt-6 pb-8 max-w-sm mx-auto w-full overflow-y-auto">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="text-center mb-5">
            <p className="text-lg font-bold text-white">¡Hola de nuevo! 👋</p>
            <p className="text-sm text-muted mt-1">Tu solicitud de factura ya fue registrada. Aquí puedes consultar su estatus.</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.05 }}
            className={`border rounded-xl p-5 text-center mb-6 ${cfg.bg}`}>
            <p className="text-3xl mb-2">{cfg.label.split(' ')[0]}</p>
            <p className={`text-xl font-bold ${cfg.color}`}>{cfg.label.split(' ').slice(1).join(' ')}</p>
            <p className="text-muted text-xs mt-2">ID: {existing.id}</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="bg-surface border border-white/10 rounded-xl p-4 space-y-3">
            <p className="text-xs text-accent font-semibold uppercase tracking-wider">Detalles de la solicitud</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Detail label="Mesa" value={existing.mesa} />
              <Detail label="Monto" value={fmt$(existing.monto)} />
              <Detail label="Tipo de pago" value={existing.tipoPago} />
              <Detail label="Fecha" value={existing.fecha} />
              <Detail label="Hora" value={existing.hora} />
              <Detail label="Mesero" value={existing.mesero} />
            </div>
            <div className="border-t border-white/10 pt-3 space-y-2">
              <Detail label="RFC" value={existing.rfc} />
              <Detail label="Razón Social" value={existing.razonSocial} />
              <Detail label="Email" value={existing.email} />
            </div>
          </motion.div>

          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
            className="text-center text-muted text-xs mt-5">
            {existing.status === 'Pendiente'
              ? 'Tu factura está siendo procesada. Recibirás un correo cuando esté lista.'
              : existing.status === 'Procesada'
              ? 'Tu factura ya fue emitida. Revisa tu correo electrónico.'
              : 'Esta solicitud fue cancelada. Contacta al restaurante para más información.'}
          </motion.p>

          {/* WhatsApp a Mozzafiato */}
          <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}
            onClick={() => {
              const url = buildNotifyWaUrl(existing.id, existing.rfc, existing.monto, existing.mesa, existing.email)
              window.open(url, '_blank')
            }}
            className="btn w-full mt-4 text-sm font-bold"
            style={{ background: '#25D366', color: '#fff' }}>
            💬 Contactar a Mozzafiato por WhatsApp
          </motion.button>
        </div>
      </div>
    )
  }

  // ── ÉXITO (acaba de enviar) ────────────────────────────────
  if (done) {
    return (
      <div className="h-dvh bg-bg flex flex-col items-center justify-center px-6 text-center overflow-hidden relative">
        {[...Array(6)].map((_, i) => (
          <motion.div key={i} className="absolute w-2 h-2 rounded-full bg-accent/20"
            initial={{ opacity: 0, y: 100, x: (i - 3) * 60 }}
            animate={{ opacity: [0, 0.6, 0], y: [100, -200], x: (i - 3) * 60 + Math.sin(i) * 30 }}
            transition={{ duration: 3, repeat: Infinity, delay: i * 0.5, ease: 'easeOut' }}
          />
        ))}
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 16 }} className="mb-4">
          <img src={LOGO} alt="Logo" className="h-24 w-auto object-contain drop-shadow-xl mx-auto" />
        </motion.div>
        <motion.div initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', damping: 16, delay: 0.15 }} className="text-6xl mb-4">
          ✅
        </motion.div>
        <AnimatePresence mode="wait">
          <motion.p key={msgIdx}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35 }}
            className="text-lg font-bold text-success mb-4 leading-snug max-w-[280px] mx-auto">
            {SUCCESS_MESSAGES[msgIdx]}
          </motion.p>
        </AnimatePresence>
        <div className="bg-surface/60 border border-white/10 rounded-xl px-4 py-3 backdrop-blur-sm mb-4">
          <p className="text-white text-sm font-medium">Mesa {data.mesa} · {fmt$(data.monto)}</p>
          <p className="text-muted text-xs mt-1">Se enviará confirmación a {form.email}</p>
        </div>

        {/* Botón WhatsApp a Mozzafiato */}
        <motion.button
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          onClick={openMozzafiatoWa}
          className="btn w-full max-w-[280px] text-sm font-bold"
          style={{ background: '#25D366', color: '#fff' }}>
          💬 Notificar a Mozzafiato por WhatsApp
        </motion.button>
        <p className="text-muted text-xs mt-2 max-w-[260px]">
          Opcional: avísanos por WhatsApp para confirmar tu solicitud
        </p>
      </div>
    )
  }

  // ── FORMULARIO ─────────────────────────────────────────────
  return (
    <div className="h-dvh bg-bg flex flex-col overflow-hidden">
      <header className="bg-surface border-b border-white/10 px-4 py-3 flex items-center gap-3">
        <img src={LOGO} alt="Logo" className="h-7 w-auto object-contain flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">Solicitar Factura</p>
          <p className="text-xs text-muted truncate">Mozzafiato</p>
        </div>
      </header>

      <div className="flex-1 px-4 pt-4 pb-8 max-w-sm mx-auto w-full overflow-y-auto">
        {/* Saludo e instrucciones */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="text-center mb-4">
          <p className="text-lg font-bold text-white">¡Hola! 👋 Gracias por tu visita</p>
          <p className="text-sm text-muted mt-1 leading-relaxed">
            Solicita tu factura en 3 sencillos pasos: busca tu RFC, confirma tus datos fiscales y listo.
          </p>
        </motion.div>

        {/* Datos del pedido */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="bg-accent/10 border border-accent/30 rounded-xl p-4 mb-5">
          <p className="text-xs text-accent font-semibold uppercase tracking-wider mb-2">Datos del pedido</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="text-muted">Mesa:</span> <span className="text-white font-bold">{data.mesa}</span></div>
            <div><span className="text-muted">Monto:</span> <span className="text-white font-bold">{fmt$(data.monto)}</span></div>
            <div><span className="text-muted">Pago:</span> <span className="text-white">{data.tipoPago}</span></div>
            <div><span className="text-muted">Fecha:</span> <span className="text-white">{data.fecha}</span></div>
          </div>
          <p className="text-xs text-muted mt-2">Mesero: {data.mesero}</p>
        </motion.div>

        {/* Error de envío */}
        {sendError && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4 text-center">
            <p className="text-red-400 text-sm font-medium mb-3">{sendError}</p>
            <div className="flex gap-2">
              <button onClick={handleRetry} disabled={sending}
                className="btn flex-1 bg-accent text-white text-sm font-bold disabled:opacity-50">
                {sending ? 'Reintentando...' : '🔄 Reintentar'}
              </button>
              <button onClick={openMozzafiatoWa}
                className="btn flex-1 text-sm font-bold"
                style={{ background: '#25D366', color: '#fff' }}>
                💬 WhatsApp
              </button>
            </div>
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {/* Fase 1: Búsqueda RFC */}
          {!selected && !isNew && (
            <motion.div key="buscar" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <div className="text-center mb-4">
                <h2 className="text-lg font-bold text-white">Buscar tu RFC</h2>
                <p className="text-xs text-muted mt-1">Si ya nos visitaste antes, búscalo aquí</p>
              </div>

              <div className="bg-surface border border-white/10 rounded-xl p-4">
                <label className="block text-xs text-muted font-medium mb-1.5">RFC o Razón Social</label>
                <input
                  value={rfcInput}
                  onChange={(e) => setRfcInput(e.target.value)}
                  placeholder="Escribe tu RFC..."
                  autoCapitalize="characters"
                  spellCheck={false}
                  className="input w-full"
                />

                {suggestions.length > 0 && (
                  <div className="border border-accent/30 rounded-lg mt-2 max-h-48 overflow-y-auto">
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

          {/* Fase 2: Formulario fiscal */}
          {(selected || isNew) && (
            <motion.div key="form" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-white">Datos Fiscales</h2>
                  <p className="text-xs text-muted mt-0.5">{isNew ? 'Nuevo cliente' : 'Confirma tus datos'}</p>
                </div>
                <button onClick={() => { setSelected(null); setIsNew(false); setRfcInput('') }}
                  className="text-xs text-accent">
                  ← Cambiar RFC
                </button>
              </div>

              <form onSubmit={handleSubmit} className="bg-surface border border-white/10 rounded-xl p-4 space-y-3">
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
                    {REGIMENES.map((r) => (
                      <option key={r.clave} value={r.clave}>{r.clave} - {r.desc}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Uso CFDI" error={errors.usoCfdi}>
                  <select value={form.usoCfdi} onChange={(e) => set('usoCfdi', e.target.value)} className="input">
                    <option value="">Seleccionar...</option>
                    {USOS_CFDI.map((u) => (
                      <option key={u.clave} value={u.clave}>{u.clave} - {u.desc}</option>
                    ))}
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

                <button type="submit" disabled={sending}
                  className="btn btn-primary w-full mt-2 disabled:opacity-50">
                  {sending ? 'Enviando... (puede tardar unos segundos)' : '🧾 Solicitar Factura'}
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ── Sub-componentes ──────────────────────────────────────────
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
