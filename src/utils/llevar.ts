// ============================================================
// LLEVAR.TS — Codificación/decodificación de links "para llevar"
// Codifica datos del pedido + config en base64 para URL
// ============================================================

import type { AppConfig } from '../api/types'

export interface LlevarData {
  mesa: string
  monto: string
  tipoPago: string
  mesero: string
  fecha: string
  hora: string
  exp: number // timestamp de expiración
  // Config embebida para que funcione en el dispositivo del cliente
  config?: AppConfig
}

const EXPIRY_MS = 5 * 24 * 60 * 60 * 1000 // 5 días

// Claves compactas para reducir tamaño del URL
interface CompactPayload {
  m: string  // mesa
  $: string  // monto
  t: string  // tipoPago
  w: string  // mesero
  f: string  // fecha
  h: string  // hora
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
 * La config se toma de localStorage del mesero que genera el link.
 */
export function encodeLlevar(data: Omit<LlevarData, 'exp' | 'config'>): string {
  const cfg = getStoredConfig()
  const payload: CompactPayload = {
    m: data.mesa, $: data.monto, t: data.tipoPago,
    w: data.mesero, f: data.fecha, h: data.hora,
    e: Date.now() + EXPIRY_MS,
    s: cfg.sheetId, a: cfg.apiKey, u: cfg.scriptUrl,
  }
  const json = JSON.stringify(payload)
  return btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Decodifica un string base64 URL-safe a LlevarData.
 * Soporta tanto claves compactas (m/$) como legacy (mesa/monto).
 * Extrae config embebida si existe.
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
        mesero: raw.w, fecha: raw.f, hora: raw.h, exp: raw.e,
      }
      // Extraer config si viene embebida
      if (raw.s && raw.a && raw.u) {
        data.config = { sheetId: raw.s, apiKey: raw.a, scriptUrl: raw.u }
      }
      if (!data.mesa || !data.monto || !data.exp) return null
      return data
    }

    // Formato legacy
    const data = raw as LlevarData
    if (!data.mesa || !data.monto || !data.exp) return null
    return data
  } catch {
    return null
  }
}

/**
 * Inyecta la config del link en localStorage (para que sheets.ts y appscript.ts la encuentren).
 * Solo escribe si no hay config existente o si está vacía.
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
 * Genera la URL completa del formulario para llevar.
 */
export function buildLlevarUrl(data: Omit<LlevarData, 'exp' | 'config'>): string {
  const base = window.location.origin + import.meta.env.BASE_URL
  const code = encodeLlevar(data)
  return `${base}?llevar=${code}`
}

/**
 * Genera el link de WhatsApp con mensaje prellenado.
 */
export function buildWhatsAppUrl(phone: string, llevarUrl: string, monto: string): string {
  // Limpiar número: solo dígitos
  const clean = phone.replace(/\D/g, '')
  // Agregar código de país si no lo tiene (México = 52)
  const full = clean.length === 10 ? `52${clean}` : clean
  const msg = encodeURIComponent(
    `¡Hola! 👋 Gracias por tu visita a *Mozzafiato* 🍕\n\n` +
    `Para solicitar tu factura por *$${monto}*, sigue estos pasos:\n\n` +
    `1️⃣ Abre el siguiente link\n` +
    `2️⃣ Busca tu RFC o regístralo como nuevo\n` +
    `3️⃣ Confirma tus datos fiscales y envía\n\n` +
    `🧾 Genera tu factura aquí:\n` +
    `${llevarUrl}\n\n` +
    `📌 *Después de enviar tu solicitud:*\n` +
    `• Vuelve a abrir este mismo link para consultar el estatus de tu factura\n` +
    `• Si tienes dudas o aclaraciones, comunícate con nosotros por este mismo chat\n\n` +
    `_Este link es válido por 5 días._`
  )
  return `https://wa.me/${full}?text=${msg}`
}

/**
 * Lee el parámetro ?llevar= de la URL actual.
 */
export function getLlevarParam(): string | null {
  const params = new URLSearchParams(window.location.search)
  return params.get('llevar')
}

/**
 * Limpia el parámetro ?llevar= de la URL sin recargar.
 */
export function clearLlevarParam(): void {
  const url = new URL(window.location.href)
  url.searchParams.delete('llevar')
  window.history.replaceState({}, '', url.toString())
}
