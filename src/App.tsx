// ============================================================
// APP.TSX — Orquestador de pantallas con animaciones de transición
// Router manual basado en FlowStep + gestión de estado de flujo
// ============================================================

import { useState, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

import { useAuth } from './auth/AuthContext'
import { SetupScreen  } from './auth/SetupScreen'
import { LoginScreen  } from './auth/LoginScreen'
import { HomePage     } from './pages/HomePage'
import { MeseroPage   } from './pages/MeseroPage'
import { ClientePage  } from './pages/ClientePage'
import { ConfirmPage  } from './pages/ConfirmPage'
import { SuccessPage  } from './pages/SuccessPage'
import { AdminPage    } from './pages/AdminPage'
import { LoadingOverlay } from './components/shared/LoadingOverlay'
import { ToastContainer } from './components/shared/Toast'
import { useToast } from './hooks/useToast'
import { useOfflineSync } from './hooks/useOfflineSync'
import { useNuevaSolicitud } from './hooks/useSheets'

import type { FlowStep, CurrentOrder } from './api/types'
import type { ClienteFormData } from './components/forms/ClienteForm'

// ── Transición de pantallas ───────────────────────────────
const slideVariants = {
  initial:  { opacity: 0, x: 40  },
  animate:  { opacity: 1, x: 0   },
  exit:     { opacity: 0, x: -40 },
}

export default function App() {
  const { step, setStep, user, logout } = useAuth()
  const { toasts, toast, dismiss } = useToast()
  const nuevaSolicitudMut = useNuevaSolicitud()

  // Estado del flujo de solicitud
  const [order,   setOrder  ] = useState<CurrentOrder | null>(null)
  const [cliente, setCliente] = useState<ClienteFormData | null>(null)
  const [isNew,   setIsNew  ] = useState(false)

  // Sync offline en background
  useOfflineSync()

  // ── Navegación ────────────────────────────────────────
  const navigate = useCallback((s: string) => {
    if (s === 'logout') { logout(); return }
    setStep(s as FlowStep)
  }, [setStep, logout])

  // ── Flujo: Mesa → Cliente → Confirm → Success ─────────
  function handleOrderDone(o: CurrentOrder) {
    setOrder(o)
    setStep('cliente')
  }

  function handleClienteDone(c: ClienteFormData, isNewClient: boolean) {
    setCliente(c)
    setIsNew(isNewClient)
    setStep('confirm')
  }

  function handleConfirm() {
    if (!order || !cliente) return

    // Cierre optimista: navegar inmediatamente
    setStep('success')

    // POST en background (IIFE async)
    ;(async () => {
      try {
        await nuevaSolicitudMut.mutateAsync({
          mesa:          order.mesa,
          monto:         order.monto,
          tipoPago:      order.tipoPago,
          notas:         order.notas,
          mesero:        order.mesero,
          rfc:           cliente.rfc,
          razonSocial:   cliente.razonSocial,
          regimen:       cliente.regimen,
          usoCfdi:       cliente.usoCfdi,
          email:         cliente.email,
          codigoPostal:  cliente.codigoPostal,
          isNewCliente:  isNew,
        })
      } catch (e) {
        toast('⚠️ Se guardó offline — se enviará al recuperar conexión', 'info')
      }
    })()
  }

  function handleNueva() {
    setOrder(null)
    setCliente(null)
    setIsNew(false)
    setStep('mesero')
  }

  return (
    <div className="font-sans antialiased text-white h-dvh overflow-hidden">
        {/* Transiciones de pantalla */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            variants={slideVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            {step === 'setup' && <SetupScreen />}

            {step === 'login' && <LoginScreen />}

            {step === 'home' && (
              <HomePage onNavigate={navigate} />
            )}

            {step === 'mesero' && user && (
              <MeseroPage
                initial={order ?? undefined}
                onNext={handleOrderDone}
                onBack={() => setStep('home')}
                userName={user.nombre}
              />
            )}

            {step === 'cliente' && order && (
              <ClientePage
                order={order}
                onNext={handleClienteDone}
                onBack={() => setStep('mesero')}
              />
            )}

            {step === 'confirm' && order && cliente && (
              <ConfirmPage
                order={order}
                cliente={cliente}
                isNew={isNew}
                onConfirm={handleConfirm}
                onBack={() => setStep('cliente')}
                onEditMesa={() => setStep('mesero')}
                onEditCliente={() => setStep('cliente')}
              />
            )}

            {step === 'success' && order && cliente && (
              <SuccessPage
                order={order}
                cliente={cliente}
                onNueva={handleNueva}
                onHome={() => setStep('home')}
              />
            )}

            {step === 'admin' && (
              <AdminPage onNavigate={navigate} />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Globales */}
        <LoadingOverlay />
        <ToastContainer toasts={toasts} dismiss={dismiss} />
      </div>
  )
}
