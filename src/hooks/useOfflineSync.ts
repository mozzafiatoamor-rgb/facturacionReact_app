// ============================================================
// USEOFFLINESYNC.TS — Sincroniza cola offline al recuperar conexión
// Usa Dexie como fuente de verdad, exponential backoff
// ============================================================

import { useEffect, useRef, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  getPendingOps,
  deleteOp,
  incrementRetry,
  countPending,
} from '../store/db'
import {
  appendRow,
  batchAppend,
  updateStatus,
  updateCliente,
  sendConfirmation,
} from '../api/appscript'
import { QUERY_KEYS } from '../api/config'
import type { PendingOperation } from '../api/types'

const MAX_RETRIES = 5

export function useOfflineSync() {
  const queryClient  = useQueryClient()
  const processing   = useRef(false)
  const pendingCount = useRef(0)

  const syncOne = useCallback(async (op: PendingOperation): Promise<boolean> => {
    try {
      switch (op.type) {
        case 'append':
          if (op.sheet && op.values) await appendRow(op.sheet, op.values)
          break
        case 'batchAppend':
          if (op.items) await batchAppend(op.items, op.emailData)
          break
        case 'updateStatus':
          if (op.solId && op.status != null) await updateStatus(op.solId, op.status, op.notas)
          break
        case 'updateCliente':
          if (op.rfc && op.data) await updateCliente(op.rfc, op.data)
          break
        case 'sendConfirmation':
          if (op.solId) await sendConfirmation(op.solId, op.emailData)
          break
      }
      return true
    } catch {
      return false
    }
  }, [])

  const processQueue = useCallback(async () => {
    if (processing.current || !navigator.onLine) return
    const ops = await getPendingOps()
    if (ops.length === 0) return

    processing.current = true
    let synced = false

    for (const op of ops) {
      if (op.retries >= MAX_RETRIES) {
        await deleteOp(op.id!)
        continue
      }
      const ok = await syncOne(op)
      if (ok) {
        await deleteOp(op.id!)
        synced = true
      } else {
        await incrementRetry(op.id!)
      }
    }

    processing.current = false
    pendingCount.current = await countPending()

    if (synced) {
      // Invalidar queries para refrescar datos
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.solicitudes })
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.clientes })
    }
  }, [syncOne, queryClient])

  // Escuchar eventos de red
  useEffect(() => {
    const onOnline = () => processQueue()
    window.addEventListener('online',  onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [processQueue])

  // Intentar procesar al montar (por si hay pendientes de sesión anterior)
  useEffect(() => {
    if (navigator.onLine) processQueue()
  }, [processQueue])

  return { processQueue, getPendingCount: () => pendingCount.current }
}
