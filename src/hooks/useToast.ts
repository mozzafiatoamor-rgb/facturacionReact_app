// ============================================================
// USETOAST.TS — Sistema propio de toasts sin librerías extra
// Singleton mediante módulo-level store → todos los componentes
// comparten la misma instancia; no requiere Provider extra.
// 3 tipos: success | error | info — auto-dismiss 2.5 s
// ============================================================

import { useState, useCallback, useEffect } from 'react'
import type { ToastMessage, ToastType } from '../api/types'

// ── Singleton store (fuera de React) ────────────────────────
let _id       = 0
let _toasts:   ToastMessage[]                           = []
let _listeners: Array<(toasts: ToastMessage[]) => void> = []

function notify() {
  _listeners.forEach((l) => l([..._toasts]))
}

/** Función global: úsala en cualquier lugar (incluso fuera de componentes) */
export function showToast(message: string, type: ToastType = 'success') {
  const id = ++_id
  _toasts = [..._toasts.slice(-4), { id, message, type }]
  notify()
  setTimeout(() => {
    _toasts = _toasts.filter((t) => t.id !== id)
    notify()
  }, 2500)
}

// ── Hook (para componentes) ─────────────────────────────────

interface UseToastReturn {
  toasts:  ToastMessage[]
  toast:   (message: string, type?: ToastType) => void
  dismiss: (id: number) => void
}

export function useToast(): UseToastReturn {
  const [toasts, setToasts] = useState<ToastMessage[]>(_toasts)

  useEffect(() => {
    const listener = (t: ToastMessage[]) => setToasts(t)
    _listeners.push(listener)
    return () => {
      _listeners = _listeners.filter((l) => l !== listener)
    }
  }, [])

  const dismiss = useCallback((id: number) => {
    _toasts = _toasts.filter((t) => t.id !== id)
    notify()
  }, [])

  const toast = useCallback(
    (message: string, type: ToastType = 'success') => showToast(message, type),
    [],
  )

  return { toasts, toast, dismiss }
}
