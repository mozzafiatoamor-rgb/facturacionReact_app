// ============================================================
// USESHEETS.TS — React Query hooks para lectura de Sheets
// staleTime configurado por tipo de dato
// ============================================================

import {
  useQuery,
  useMutation,
  useQueryClient,
  useIsFetching,
} from '@tanstack/react-query'
import { fetchClientes, fetchSolicitudes, fetchUsuarios, fetchBitacora } from '../api/sheets'
import { updateStatus, updateCliente, sendConfirmation, batchAppend } from '../api/appscript'
import { enqueueOp } from '../store/db'
import { QUERY_KEYS, STALE_TIMES } from '../api/config'
import { now } from '../utils/dates'
import { generateId } from '../utils/ids'
import type { Solicitud, Cliente, BatchItem, EmailData } from '../api/types'
import { SHEET_NAMES } from '../api/config'

// ── Lecturas ───────────────────────────────────────────────

export function useUsuarios() {
  return useQuery({
    queryKey:  QUERY_KEYS.usuarios,
    queryFn:   fetchUsuarios,
    staleTime: STALE_TIMES.usuarios,
    retry: 2,
  })
}

export function useSolicitudes() {
  return useQuery({
    queryKey:  QUERY_KEYS.solicitudes,
    queryFn:   fetchSolicitudes,
    staleTime: STALE_TIMES.solicitudes,
    retry: 2,
  })
}

export function useClientes() {
  return useQuery({
    queryKey:  QUERY_KEYS.clientes,
    queryFn:   fetchClientes,
    staleTime: STALE_TIMES.clientes,
    retry: 2,
  })
}

export function useBitacora() {
  return useQuery({
    queryKey:  QUERY_KEYS.bitacora,
    queryFn:   fetchBitacora,
    staleTime: STALE_TIMES.bitacora,
    retry: 2,
  })
}

// ── isLoading global (para LoadingOverlay) ─────────────────
export function useGlobalFetching() {
  return useIsFetching() > 0
}

// ── Invalidaciones ─────────────────────────────────────────
export function useInvalidate() {
  const qc = useQueryClient()
  return {
    solicitudes: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.solicitudes }),
    clientes:    () => qc.invalidateQueries({ queryKey: QUERY_KEYS.clientes }),
    bitacora:    () => qc.invalidateQueries({ queryKey: QUERY_KEYS.bitacora }),
    all:         () => qc.invalidateQueries(),
  }
}

// ── Mutación: nueva solicitud (optimistic) ─────────────────
interface NuevaSolicitudInput {
  mesa:        string
  monto:       string
  tipoPago:    string
  notas:       string
  mesero:      string
  rfc:         string
  razonSocial: string
  regimen:     string
  usoCfdi:     string
  email:       string
  codigoPostal:string
  isNewCliente:boolean
}

export function useNuevaSolicitud() {
  const qc       = useQueryClient()
  const invalidate = useInvalidate()

  return useMutation({
    mutationFn: async (input: NuevaSolicitudInput) => {
      const { date, time } = now()
      const solId = generateId('SOL')

      // Filas para batchAppend
      const items: BatchItem[] = []

      // regimen y usoCfdi ya vienen como texto completo desde el formulario
      // Ej: "626 - Régimen Simplificado de Confianza (RESICO)"
      const regimenStr = input.regimen
      const cfdiStr    = input.usoCfdi
      items.push({
        sheet: SHEET_NAMES.solicitudes,
        rows: [[
          solId,
          date,
          time,
          input.mesa,
          input.monto,
          input.tipoPago,
          input.rfc,
          input.razonSocial,
          regimenStr,
          cfdiStr,
          input.email,
          'Pendiente',
          input.mesero,
          input.notas,
          input.codigoPostal,
        ]],
      })

      // Si es cliente nuevo, agregarlo a Clientes
      if (input.isNewCliente) {
        const cliId = generateId('CLI')
        items.push({
          sheet: SHEET_NAMES.clientes,
          rows: [[
            cliId,
            input.rfc,
            input.razonSocial,
            regimenStr,
            cfdiStr,
            input.email,
            date,
            '',          // telefono
            input.codigoPostal,
          ]],
        })
      }

      // Bitácora
      items.push({
        sheet: SHEET_NAMES.bitacora,
        rows: [[date, time, input.mesero, 'Nueva Solicitud', `${input.rfc} Mesa ${input.mesa}`, 'solicitud']],
      })

      // Datos para el email de confirmación (Apps Script lo usa para enviar correo)
      const emailData: EmailData = {
        id:          solId,
        fecha:       date,
        hora:        time,
        mesa:        input.mesa,
        monto:       input.monto,
        tipoPago:    input.tipoPago,
        rfc:         input.rfc,
        razonSocial: input.razonSocial,
        regimen:     regimenStr,
        usoCfdi:     cfdiStr,
        email:       input.email,
        status:      'Pendiente',
        mesero:      input.mesero,
      }

      // Intentar enviar; si falla, encolar para offline
      try {
        await batchAppend(items, emailData)
      } catch {
        await enqueueOp({
          type:      'batchAppend',
          items,
          emailData,
          createdAt: Date.now(),
          retries:   0,
        })
      }

      return solId
    },

    // Optimistic update: añadir solicitud local antes de la respuesta
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: QUERY_KEYS.solicitudes })
      const prev = qc.getQueryData<Solicitud[]>(QUERY_KEYS.solicitudes) ?? []
      const { date, time } = now()

      const optimistic: Solicitud = {
        id:          '…',
        fecha:       date,
        hora:        time,
        mesa:        input.mesa,
        monto:       input.monto,
        tipoPago:    input.tipoPago,
        rfc:         input.rfc,
        razonSocial: input.razonSocial,
        regimen:     input.regimen,
        usoCfdi:     input.usoCfdi,
        email:       input.email,
        status:      'Pendiente',
        mesero:      input.mesero,
        notas:       input.notas,
        codigoPostal:input.codigoPostal,
        _row:        -1,
        _optimistic: true,
      }

      qc.setQueryData<Solicitud[]>(QUERY_KEYS.solicitudes, [optimistic, ...prev])
      return { prev }
    },

    onError: (_err, _input, ctx) => {
      if (ctx?.prev) {
        qc.setQueryData(QUERY_KEYS.solicitudes, ctx.prev)
      }
    },

    onSettled: () => {
      invalidate.solicitudes()
      invalidate.clientes()
    },
  })
}

// ── Mutación: cambiar status de solicitud ──────────────────
export function useUpdateStatus() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ solId, status, notas = '' }: { solId: string; status: string; notas?: string }) =>
      updateStatus(solId, status, notas),
    onError: async (_err, vars) => {
      await enqueueOp({
        type: 'updateStatus', solId: vars.solId, status: vars.status, notas: vars.notas,
        createdAt: Date.now(), retries: 0,
      })
    },
    onSettled: () => invalidate.solicitudes(),
  })
}

// ── Mutación: actualizar cliente ───────────────────────────
export function useUpdateCliente() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ rfc, data }: { rfc: string; data: Partial<Cliente> }) =>
      updateCliente(rfc, data),
    onError: async (_err, vars) => {
      await enqueueOp({
        type: 'updateCliente', rfc: vars.rfc, data: vars.data,
        createdAt: Date.now(), retries: 0,
      })
    },
    onSettled: () => invalidate.clientes(),
  })
}

// ── Mutación: enviar confirmación por email ────────────────
export function useSendConfirmation() {
  return useMutation({
    mutationFn: ({ solId }: { solId: string }) => sendConfirmation(solId),
    onError: async (_err, vars) => {
      await enqueueOp({
        type: 'sendConfirmation', solId: vars.solId,
        createdAt: Date.now(), retries: 0,
      })
    },
  })
}
