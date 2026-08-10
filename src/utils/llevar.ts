// ============================================================
// LLEVAR.TS — Codificación/decodificación de links "para llevar"
// Codifica datos del pedido en base64 para URL, con expiración 24h
// ============================================================

export interface LlevarData {
  mesa: string
  monto: string
  tipoPago: string
  mesero: string
  fecha: string
  hora: string
  exp: number // timestamp de expiración
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
}

/**
 * Codifica los datos del pedido en un string base64 URL-safe (claves cortas).
 */
export function encodeLlevar(data: Omit<LlevarData, 'exp'>): string {
  const payload: CompactPayload = {
    m: data.mesa, $: data.monto, t: data.tipoPago,
    w: data.mesero, f: data.fecha, h: data.hora,
    e: Date.now() + EXPIRY_MS,
  }
  const json = JSON.stringify(payload)
  return btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Decodifica un string base64 URL-safe a LlevarData.
 * Soporta tanto claves compactas (m/$) como legacy (mesa/monto).
 */
export function decodeLlevar(encoded: string): LlevarData | null {
  try {
    let b64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
    while (b64.length % 4) b64 += '='
    const json = atob(b64)
    const raw = JSON.parse(json)

    // Soportar ambos formatos
    const data: LlevarData = raw.m != null
      ? { mesa: raw.m, monto: raw.$, tipoPago: raw.t, mesero: raw.w, fecha: raw.f, hora: raw.h, exp: raw.e }
      : raw as LlevarData

    if (!data.mesa || !data.monto || !data.exp) return null
    return data
  } catch {
    return null
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
export function buildLlevarUrl(data: Omit<LlevarData, 'exp'>): string {
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
