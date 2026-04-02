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
