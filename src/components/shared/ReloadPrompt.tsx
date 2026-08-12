// ============================================================
// RELOADPROMPT.TSX — Auto-actualización de la PWA
// Al detectar nueva versión, recarga automáticamente la app.
// Muestra un breve splash "Actualizando..." mientras recarga.
// ============================================================

import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

export function ReloadPrompt() {
  const [updating, setUpdating] = useState(false)

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Al abrir la app, busca si hay nueva versión disponible
      if (registration) {
        registration.update()
      }
    },
  })

  // Cuando detecta nueva versión, actualiza automáticamente
  useEffect(() => {
    if (needRefresh) {
      setUpdating(true)
      updateServiceWorker(true) // activa el nuevo SW y recarga
    }
  }, [needRefresh, updateServiceWorker])

  if (!updating) return null

  // Splash breve mientras recarga
  return (
    <div className="fixed inset-0 z-[9999] bg-bg flex flex-col items-center justify-center">
      <div className="w-8 h-8 border-3 border-accent border-t-transparent rounded-full animate-spin mb-4" />
      <p className="text-white text-sm font-medium">Actualizando...</p>
      <p className="text-muted text-xs mt-1">Un momento por favor</p>
    </div>
  )
}
