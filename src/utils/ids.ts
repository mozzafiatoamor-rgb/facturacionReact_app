// ── Generación de IDs únicos ──────────────────────────────

/**
 * Genera ID único con prefijo + timestamp + random corto.
 * Ej: "SOL-1712345678-42"
 */
export function generateId(prefix: string): string {
  const ts   = Date.now()
  const rand = Math.floor(Math.random() * 100)
  return `${prefix}-${ts}-${rand}`
}

/**
 * Normaliza texto para comparación de duplicados:
 * lowercase + sin acentos + sin caracteres especiales
 */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // quita diacríticos
    .replace(/[^a-z0-9\s]/g, '')      // quita caracteres especiales
    .trim()
    .replace(/\s+/g, ' ')             // normaliza espacios
}

/**
 * Extrae palabras clave (≥4 chars) de un texto normalizado.
 */
export function keywords(text: string): string[] {
  return normalize(text).split(' ').filter((w) => w.length >= 4)
}

/**
 * Detecta si dos textos comparten palabras clave (nivel similar).
 */
export function hasSimilarKeywords(a: string, b: string): boolean {
  const ka = new Set(keywords(a))
  const kb = keywords(b)
  return kb.some((w) => ka.has(w))
}
