// ── Fecha y hora en formato mexicano ──────────────────────

export function nowDate(): string {
  return new Date().toLocaleDateString('es-MX', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

export function nowTime(): string {
  return new Date().toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export function now(): { date: string; time: string } {
  return { date: nowDate(), time: nowTime() }
}

// ── Formateo de moneda MXN ────────────────────────────────

export function fmt$(n: number | string): string {
  return '$' + Number(n || 0).toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

// ── Parseo de fecha DD/MM/YYYY → Date ────────────────────

export function parseDate(str: string): Date | null {
  const parts = str.split('/')
  if (parts.length !== 3) return null
  const [d, m, y] = parts.map(Number)
  return new Date(y, m - 1, d)
}

// ── Verifica si una fecha es de hoy ──────────────────────

export function isToday(str: string): boolean {
  const d = parseDate(str)
  if (!d) return false
  const today = new Date()
  return (
    d.getDate()     === today.getDate()     &&
    d.getMonth()    === today.getMonth()    &&
    d.getFullYear() === today.getFullYear()
  )
}

// ── Etiqueta relativa rápida ──────────────────────────────

export function relativeLabel(str: string): string {
  const d = parseDate(str)
  if (!d) return str
  const diff = Math.floor((Date.now() - d.getTime()) / 86_400_000)
  if (diff === 0) return 'Hoy'
  if (diff === 1) return 'Ayer'
  if (diff < 7)  return `Hace ${diff} días`
  return str
}
