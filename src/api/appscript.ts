// ============================================================
// APPSCRIPT.TS — SOLO ESCRITURAS vía Apps Script Web App POST
// Único canal de mutación. NetworkOnly en Workbox.
// ============================================================

import type { AppConfig, BatchItem, Cliente, EmailData } from './types'

function getConfig(): AppConfig {
  try {
    return JSON.parse(localStorage.getItem('_mzf_facturas_config') ?? 'null') ?? { sheetId: '', apiKey: '', scriptUrl: '' }
  } catch {
    return { sheetId: '', apiKey: '', scriptUrl: '' }
  }
}

function getScriptUrl(): string {
  const { scriptUrl } = getConfig()
  if (!scriptUrl) throw new Error('Apps Script URL no configurada')
  return scriptUrl
}

async function post<T>(body: object): Promise<T> {
  const url = getScriptUrl()
  const res = await fetch(url, {
    method: 'POST',
    body: JSON.stringify(body),
  })
  const data = await res.json() as { success: boolean; error?: string } & T
  if (!data.success) throw new Error(data.error ?? 'Error en Apps Script')
  return data
}

// ── APPEND genérico ────────────────────────────────────────
export async function appendRow(sheet: string, values: string[]): Promise<void> {
  await post({ action: 'append', sheet, values })
}

// ── BATCH APPEND (optimiza cold-start: 1 llamada HTTP) ─────
export async function batchAppend(
  items: BatchItem[],
  emailData?: EmailData,
): Promise<void> {
  const body: Record<string, unknown> = { action: 'batchAppend', items }
  if (emailData) body.emailData = emailData
  await post(body)
}

// ── UPDATE STATUS ──────────────────────────────────────────
export async function updateStatus(
  solId: string,
  status: string,
  notas = '',
): Promise<void> {
  await post({ action: 'updateStatus', solId, status, notas })
}

// ── UPDATE CLIENTE ─────────────────────────────────────────
export async function updateCliente(
  rfc: string,
  data: Partial<Cliente>,
): Promise<void> {
  await post({ action: 'updateCliente', rfc, data })
}

// ── SEND CONFIRMATION (email) ──────────────────────────────
export async function sendConfirmation(
  solId: string,
  emailData?: EmailData,
): Promise<void> {
  await post({ action: 'sendConfirmation', solId, emailData })
}

// ── DELETE ROW ─────────────────────────────────────────────
export async function deleteRow(sheet: string, row: number): Promise<void> {
  await post({ action: 'delete', sheet, row })
}

// ── CLEANUP FAILED (elimina solicitud + cliente fallido) ──
export async function cleanupFailed(
  solId: string,
  rfc: string,
  isNewCliente: boolean,
): Promise<void> {
  await post({ action: 'cleanupFailed', solId, rfc, isNewCliente })
}

// ── TIMBRAR FACTURA (Facturapi) ───────────────────────────
export interface TimbradoInput {
  rfc: string
  razonSocial: string
  regimen: string
  usoCfdi: string
  email: string
  codigoPostal: string
  telefono?: string
  monto: string
  tipoPago: string
  negocio: string
  folioPrefix?: string
  mesa?: string
  mesero?: string
  comentarios?: string
}

export interface TimbradoResult {
  success: boolean
  invoiceId: string
  uuid: string
  folioNumber: string
  pdfBase64: string
  xmlBase64: string
  error?: string
}

export async function timbrarFactura(input: TimbradoInput): Promise<TimbradoResult> {
  return post<TimbradoResult>({ action: 'timbrarFactura', ...input })
}

// ── LINKS CORTOS ──────────────────────────────────────────
export interface LinkPayload {
  m: string   // mesa
  $: string   // monto
  t: string   // tipoPago
  w: string   // mesero
  f: string   // fecha
  h: string   // hora
  n: string   // negocio
  e: number   // exp timestamp
}

export async function createLink(payload: LinkPayload): Promise<string> {
  const res = await post<{ code: string }>({ action: 'createLink', payload })
  return res.code
}

export async function getLink(code: string): Promise<LinkPayload> {
  const res = await post<{ payload: LinkPayload }>({ action: 'getLink', code })
  return res.payload
}
