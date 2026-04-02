// ============================================================
// USETABHISTORY.TS — Navegación con historia + swipe desde borde
// Integra window.history.pushState → botón back de Android funciona
// Swipe desde borde izquierdo (startX < 50 && dx > 75) → atrás
// ============================================================

import { useCallback, useEffect, useRef } from 'react'
import type { FlowStep } from '../api/types'

interface UseTabHistoryOptions {
  onBack?: () => void
}

export function useTabHistory(
  step: FlowStep,
  push: (s: FlowStep) => void,
  options: UseTabHistoryOptions = {},
) {
  const stackRef = useRef<FlowStep[]>([step])
  const { onBack } = options

  // Sincronizar pushState al cambiar step
  useEffect(() => {
    const stack = stackRef.current
    const last = stack[stack.length - 1]
    if (last === step) return

    // Push nuevo estado a la historia del browser
    window.history.pushState({ step }, '', window.location.href)
    stackRef.current = [...stack, step]
  }, [step])

  // Interceptar botón back de Android / browser
  useEffect(() => {
    function handlePop(e: PopStateEvent) {
      const state = e.state as { step?: FlowStep } | null
      if (state?.step) {
        push(state.step)
        stackRef.current = stackRef.current.slice(0, -1)
      } else if (stackRef.current.length > 1) {
        stackRef.current = stackRef.current.slice(0, -1)
        const stack = stackRef.current
        const prev = stack[stack.length - 1]
        if (prev) push(prev)
      }
      onBack?.()
    }

    window.addEventListener('popstate', handlePop)
    return () => window.removeEventListener('popstate', handlePop)
  }, [push, onBack])

  // Swipe desde borde izquierdo
  const touchStartX = useRef(0)

  const onTouchStart = useCallback((e: TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }, [])

  const onTouchEnd = useCallback(
    (e: TouchEvent) => {
      const dx = e.changedTouches[0].clientX - touchStartX.current
      if (touchStartX.current < 50 && dx > 75) {
        onBack?.()
        window.history.back()
      }
    },
    [onBack],
  )

  useEffect(() => {
    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchend',   onTouchEnd,   { passive: true })
    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchend',   onTouchEnd)
    }
  }, [onTouchStart, onTouchEnd])

  function goBack() {
    if (stackRef.current.length > 1) {
      window.history.back()
    }
  }

  return { goBack, stack: stackRef.current }
}
