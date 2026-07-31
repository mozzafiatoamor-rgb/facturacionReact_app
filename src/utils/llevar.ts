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

const EXPIRY_MS = 24 * 60 * 60 * 1000 // 24 horas

/**
 * Codifica los datos del pedido en un string base64 URL-safe.
 */
export function encodeLlevar(data: Omit<LlevarData, 'exp'>): string {
  const payload: LlevarData = { ...data, exp: Date.now() + EXPIRY_MS }
  const json = JSON.stringify(payload)
  // btoa + URL-safe: reemplaza +/= por caracteres seguros
  return btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Decodifica un string base64 URL-safe a LlevarData.
 * Retorna null si el formato es inválido.
 */
export function decodeLlevar(encoded: string): LlevarData | null {
  try {
    // Restaurar base64 estándar
    let b64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
    while (b64.length % 4) b64 += '='
    const json = atob(b64)
    const data = JSON.parse(json) as LlevarData
    // Validar campos mínimos
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
    `🧾 *Mozzafiato Facturas*\n\n` +
    `Hola, aquí tienes el link para solicitar tu factura por $${monto}:\n\n` +
    `${llevarUrl}\n\n` +
    `⏰ Este link es válido por 24 horas.`
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
