// ============================================================
// SHEETS.TS — SOLO LECTURAS vía Google Sheets API v4
// Sin CORS, rápido, con API Key pública (solo lectura)
// ============================================================

import type { Cliente, Solicitud, Usuario, BitacoraEntry, AppConfig } from './types'
import { SHEET_RANGES } from './config'

function getConfig(): AppConfig {
  try {
    return JSON.parse(localStorage.getItem('_mzf_facturas_config') ?? 'null') ?? { sheetId: '', apiKey: '', scriptUrl: '' }
  } catch {
    return { sheetId: '', apiKey: '', scriptUrl: '' }
  }
}

async function readRange(range: string): Promise<string[][]> {
  const { sheetId, apiKey } = getConfig()
  if (!sheetId || !apiKey) return []

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?key=${apiKey}`
  const res = await fetch(url)
  const data = await res.json()

  if (data.error) {
    const msg = data.error.message ?? 'Error desconocido'
    console.warn(`[Sheets] Error [${range}]:`, data.error.code, msg)
    throw new Error(`${data.error.code}: ${msg}`)
  }

  return (data.values ?? []) as string[][]
}

// ── CLIENTES ───────────────────────────────────────────────
export async function fetchClientes(): Promise<Cliente[]> {
  const rows = await readRange(SHEET_RANGES.clientes)
  return rows.map((r, i) => ({
    id:           r[0] ?? '',
    rfc:          r[1] ?? '',
    razonSocial:  r[2] ?? '',
    regimen:      (r[3] ?? '').split(' - ')[0],
    usoCfdi:      (r[4] ?? '').split(' - ')[0],
    email:        r[5] ?? '',
    ultimaSol:    r[6] ?? '',
    telefono:     r[7] ?? '',
    codigoPostal: r[8] ?? '',
    _row:         i + 2,
  }))
}

// ── SOLICITUDES ────────────────────────────────────────────
export async function fetchSolicitudes(): Promise<Solicitud[]> {
  const rows = await readRange(SHEET_RANGES.solicitudes)
  return rows.map((r, i) => ({
    id:           r[0]  ?? '',
    fecha:        r[1]  ?? '',
    hora:         r[2]  ?? '',
    mesa:         r[3]  ?? '',
    monto:        r[4]  ?? '',
    tipoPago:     r[5]  ?? '',
    rfc:          r[6]  ?? '',
    razonSocial:  r[7]  ?? '',
    regimen:      (r[8]  ?? '').split(' - ')[0],
    usoCfdi:      (r[9]  ?? '').split(' - ')[0],
    email:        r[10] ?? '',
    status:       (r[11] ?? 'Pendiente') as Solicitud['status'],
    mesero:       r[12] ?? '',
    notas:        r[13] ?? '',
    codigoPostal: r[14] ?? '',
    _row:         i + 2,
  }))
}

// ── USUARIOS ───────────────────────────────────────────────
export async function fetchUsuarios(): Promise<Usuario[]> {
  const rows = await readRange(SHEET_RANGES.usuarios)
  return rows.map((r, i) => ({
    id:     r[0] ?? '',
    nombre: r[1] ?? '',
    pin:    String(r[2] ?? ''),
    rol:    (r[3] ?? 'mesero') as Usuario['rol'],
    activo: String(r[4] ?? 'true').toUpperCase() !== 'FALSE',
    _row:   i + 2,
  }))
}

// ── BITÁCORA ───────────────────────────────────────────────
export async function fetchBitacora(): Promise<BitacoraEntry[]> {
  const rows = await readRange(SHEET_RANGES.bitacora)
  return rows.map((r, i) => ({
    fecha:   r[0] ?? '',
    hora:    r[1] ?? '',
    usuario: r[2] ?? '',
    accion:  r[3] ?? '',
    detalle: r[4] ?? '',
    tipo:    r[5] ?? '',
    _row:    i + 2,
  }))
}
