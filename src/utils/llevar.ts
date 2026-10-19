// ============================================================
// LLEVAR.TS — Codificación/decodificación de links "para llevar"
// Codifica datos del pedido + config + negocio en base64 para URL
// ============================================================

import { createLink } from '../api/appscript'
import type { AppConfig } from '../api/types'

export interface LlevarData {
  mesa: string
  monto: string
  tipoPago: string
  mesero: string
  fecha: string
  hora: string
  negocio: string    // 'mozzafiato' | 'casaregina'
  exp: number        // timestamp de expiración
  linkCode?: string  // código único del link (6 chars)
  config?: AppConfig // config embebida para dispositivo del cliente (legacy)
}

/** Calcula ms hasta el último segundo del mes actual */
export function msToEndOfMonth(): number {
  const now = new Date()
  // Último día del mes actual a las 23:59:59
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
  return endOfMonth.getTime() - now.getTime()
}


// Claves compactas para reducir tamaño del URL
interface CompactPayload {
  m: string  // mesa
  $: string  // monto
  t: string  // tipoPago
  w: string  // mesero
  f: string  // fecha
  h: string  // hora
  n: string  // negocio
  e: number  // exp
  // Config compacta
  s: string  // sheetId
  a: string  // apiKey
  u: string  // scriptUrl
}

function getStoredConfig(): AppConfig {
  try {
    return JSON.parse(localStorage.getItem('_mzf_facturas_config') ?? 'null') ?? { sheetId: '', apiKey: '', scriptUrl: '' }
  } catch {
    return { sheetId: '', apiKey: '', scriptUrl: '' }
  }
}

/**
 * Codifica los datos del pedido + config en un string base64 URL-safe.
 */
export function encodeLlevar(data: Omit<LlevarData, 'exp' | 'config'>): string {
  const cfg = getStoredConfig()
  const payload: CompactPayload = {
    m: data.mesa, $: data.monto, t: data.tipoPago,
    w: data.mesero, f: data.fecha, h: data.hora,
    n: data.negocio || 'mozzafiato',
    e: Date.now() + msToEndOfMonth(),
    s: cfg.sheetId, a: cfg.apiKey, u: cfg.scriptUrl,
  }
  const json = JSON.stringify(payload)
  return btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Decodifica un string base64 URL-safe a LlevarData.
 */
export function decodeLlevar(encoded: string): LlevarData | null {
  try {
    let b64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
    while (b64.length % 4) b64 += '='
    const json = atob(b64)
    const raw = JSON.parse(json)

    // Formato compacto
    if (raw.m != null) {
      const data: LlevarData = {
        mesa: raw.m, monto: raw.$, tipoPago: raw.t,
        mesero: raw.w, fecha: raw.f, hora: raw.h,
        negocio: raw.n || 'mozzafiato',
        exp: raw.e,
      }
      if (raw.s && raw.a && raw.u) {
        data.config = { sheetId: raw.s, apiKey: raw.a, scriptUrl: raw.u }
      }
      if (!data.mesa || !data.monto || !data.exp) return null
      return data
    }

    // Formato legacy
    const data = raw as LlevarData
    if (!data.negocio) data.negocio = 'mozzafiato'
    if (!data.mesa || !data.monto || !data.exp) return null
    return data
  } catch {
    return null
  }
}

/**
 * Inyecta la config del link en localStorage.
 */
export function injectConfig(config: AppConfig): void {
  const existing = getStoredConfig()
  if (!existing.sheetId && !existing.apiKey && !existing.scriptUrl) {
    localStorage.setItem('_mzf_facturas_config', JSON.stringify(config))
  }
}

/**
 * Verifica si un LlevarData ya expiró.
 */
export function isExpired(data: LlevarData): boolean {
  return Date.now() > data.exp
}

/**
 * Extrae el deployment ID del scriptUrl de Apps Script.
 * URL format: https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec
 */
function getDeploymentId(): string {
  const cfg = getStoredConfig()
  const match = cfg.scriptUrl.match(/\/macros\/s\/([^/]+)\/exec/)
  return match?.[1] ?? ''
}

/**
 * Reconstruye el scriptUrl a partir del deployment ID.
 */
function buildScriptUrl(deployId: string): string {
  return `https://script.google.com/macros/s/${deployId}/exec`
}

/**
 * Genera la URL completa del formulario para llevar (con link corto vía API).
 * Formato: ?llevar=CODE.DEPLOYMENT_ID
 */
export async function buildLlevarUrl(data: Omit<LlevarData, 'exp' | 'config'>): Promise<string> {
  const base = window.location.origin + import.meta.env.BASE_URL
  const deployId = getDeploymentId()
  try {
    const code = await createLink({
      m: data.mesa, $: data.monto, t: data.tipoPago,
      w: data.mesero, f: data.fecha, h: data.hora,
      n: data.negocio || 'mozzafiato',
      e: Date.now() + msToEndOfMonth(),
    })
    // CODE.DEPLOYMENT_ID — el cliente puede reconstruir el scriptUrl
    return `${base}?llevar=${code}.${deployId}`
  } catch {
    // Fallback a base64 si falla el API
    const code = encodeLlevar(data)
    return `${base}?llevar=${code}`
  }
}

/**
 * Detecta si un parámetro llevar es un link corto (CODE.DEPLOY_ID).
 */
export function isShortLink(param: string): boolean {
  // Short links: 6-char code + "." + deployment ID (~80 chars)
  // Base64 links: much longer and don't contain "." (use - and _)
  return param.includes('.') && param.split('.')[0].length <= 10
}

/**
 * Resuelve un código corto de link a LlevarData vía GET al Apps Script.
 * No necesita config en localStorage — el deployment ID viene en el param.
 */
export async function resolveShortLink(param: string): Promise<LlevarData | null> {
  try {
    const dotIdx = param.indexOf('.')
    if (dotIdx === -1) return null
    const code = param.slice(0, dotIdx)
    const deployId = param.slice(dotIdx + 1)
    const scriptUrl = buildScriptUrl(deployId)

    // GET público — no necesita auth ni config
    const res = await fetch(`${scriptUrl}?link=${encodeURIComponent(code)}`)
    const json = await res.json() as { success: boolean; payload?: Record<string, unknown>; error?: string }
    if (!json.success || !json.payload) return null

    const p = json.payload as Record<string, string | number>
    if (!p.m || !p.$ || !p.e) return null
    if (Date.now() > (p.e as number)) return null

    // Construir config para el cliente a partir de lo que guardó createLink
    const config: AppConfig = {
      sheetId: (p.sid as string) || '',
      apiKey: (p.akey as string) || '',
      scriptUrl,
    }

    return {
      mesa: p.m as string,
      monto: p.$ as string,
      tipoPago: p.t as string,
      mesero: p.w as string,
      fecha: p.f as string,
      hora: p.h as string,
      negocio: (p.n as string) || 'mozzafiato',
      exp: p.e as number,
      linkCode: code,
      config,
    }
  } catch {
    return null
  }
}

/**
 * Genera el link de WhatsApp con mensaje prellenado.
 */
export function buildWhatsAppMessage(llevarUrl: string, monto: string, negocioName = 'Mozzafiato'): string {
  // Calcular último día del mes actual
  const now = new Date()
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const limitStr = lastDay.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })

  return (
    `¡Hola! Gracias por tu preferencia en *${negocioName}* 🍕\n\n` +
    `Aquí tienes tu enlace para generar tu factura:\n\n` +
    `💰 *Monto:* $${monto}\n` +
    `🧾 *Link:* ${llevarUrl}\n\n` +
    `Solo abre el enlace, ingresa tus datos fiscales y descarga tu factura al instante (PDF y XML).\n\n` +
    `📧 También recibirás una copia en tu correo.\n\n` +
    `_Tienes hasta el ${limitStr} para facturar._`
  )
}

export function buildWhatsAppUrl(phone: string, llevarUrl: string, monto: string, negocioName = 'Mozzafiato'): string {
  const clean = phone.replace(/\D/g, '')
  const full = clean.length === 10 ? `52${clean}` : clean
  const msg = encodeURIComponent(buildWhatsAppMessage(llevarUrl, monto, negocioName))
  return `https://wa.me/${full}?text=${msg}`
}

// ── Token del despacho contable ──────────────────────────────
// Codifica la config para que el despacho pueda acceder sin login

export function encodeDespacho(): string {
  const cfg = getStoredConfig()
  const payload = { s: cfg.sheetId, a: cfg.apiKey, u: cfg.scriptUrl }
  const json = JSON.stringify(payload)
  return btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function decodeDespacho(encoded: string): AppConfig | null {
  try {
    let b64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
    while (b64.length % 4) b64 += '='
    const json = atob(b64)
    const raw = JSON.parse(json)
    if (!raw.s || !raw.a || !raw.u) return null
    return { sheetId: raw.s, apiKey: raw.a, scriptUrl: raw.u }
  } catch {
    return null
  }
}

/**
 * Lee el parámetro ?llevar= de la URL actual.
 */
export function getLlevarParam(): string | null {
  const params = new URLSearchParams(window.location.search)
  return params.get('llevar')
}

/**
 * Lee el parámetro ?despacho= de la URL actual.
 */
export function getDespachoParam(): string | null {
  const params = new URLSearchParams(window.location.search)
  return params.get('despacho')
}

/**
 * Limpia parámetros especiales de la URL sin recargar.
 */
export function clearSpecialParams(): void {
  const url = new URL(window.location.href)
  url.searchParams.delete('llevar')
  url.searchParams.delete('despacho')
  window.history.replaceState({}, '', url.toString())
}

/**
 * @deprecated Use clearSpecialParams instead
 */
export function clearLlevarParam(): void {
  clearSpecialParams()
}
