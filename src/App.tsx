// ============================================================
// APP.TSX — Orquestador de pantallas con animaciones de transición
// Router manual basado en FlowStep + gestión de estado de flujo
// Detecta ?llevar= y ?despacho= en URL para vistas públicas
// ============================================================

import { useState, useCallback, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useQueryClient } from '@tanstack/react-query'

import { useAuth } from './auth/AuthContext'
import { SetupScreen  } from './auth/SetupScreen'
import { LoginScreen  } from './auth/LoginScreen'
import { HomePage     } from './pages/HomePage'
import { MeseroPage   } from './pages/MeseroPage'
import { ClientePage  } from './pages/ClientePage'
import { ConfirmPage  } from './pages/ConfirmPage'
import { SuccessPage  } from './pages/SuccessPage'
import { AdminPage    } from './pages/AdminPage'
import { LlevarPage   } from './pages/LlevarPage'
import { DespachoPage } from './pages/DespachoPage'
import { LoadingOverlay } from './components/shared/LoadingOverlay'
import { ToastContainer } from './components/shared/Toast'
import { ReloadPrompt } from './components/shared/ReloadPrompt'
import { useToast } from './hooks/useToast'
import { useOfflineSync } from './hooks/useOfflineSync'
import { useNuevaSolicitud } from './hooks/useSheets'
import { fetchSolicitudes, fetchClientes, fetchUsuarios, fetchBitacora } from './api/sheets'
import { QUERY_KEYS, STALE_TIMES } from './api/config'
import {
  getLlevarParam, decodeLlevar, isExpired,
  getDespachoParam, decodeDespacho,
  clearSpecialParams, injectConfig,
} from './utils/llevar'
import { LOGO } from './assets/logo'

import type { FlowStep, CurrentOrder } from './api/types'
import type { LlevarData } from './utils/llevar'
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
  const queryClient = useQueryClient()

  // Estado del flujo de solicitud
  const [order,   setOrder  ] = useState<CurrentOrder | null>(null)
  const [cliente, setCliente] = useState<ClienteFormData | null>(null)
  const [isNew,   setIsNew  ] = useState(false)

  // ── Detectar links especiales en URL ──────────────────────
  const [llevarData, setLlevarData] = useState<LlevarData | null>(null)
  const [llevarExpired, setLlevarExpired] = useState(false)
  const [isDespacho, setIsDespacho] = useState(false)

  useEffect(() => {
    // Primero: ¿es link de despacho contable? (o ya se marcó como despacho antes)
    const despachoParam = getDespachoParam()
    if (despachoParam) {
      const cfg = decodeDespacho(despachoParam)
      if (cfg) {
        injectConfig(cfg)
        localStorage.setItem('_mzf_despacho', 'true')
        setIsDespacho(true)
        clearSpecialParams()
        return
      }
    }
    // Si ya visitó como despacho antes (app instalada o bookmark)
    if (localStorage.getItem('_mzf_despacho') === 'true') {
      setIsDespacho(true)
      return
    }

    // Segundo: ¿es link "para llevar" de cliente?
    const param = getLlevarParam()
    if (!param) return
    const decoded = decodeLlevar(param)
    if (!decoded) return
    if (isExpired(decoded)) {
      setLlevarExpired(true)
      clearSpecialParams()
    } else {
      if (decoded.config) injectConfig(decoded.config)
      setLlevarData(decoded)
      clearSpecialParams()
    }
  }, [])

  // Sync offline en background
  useOfflineSync()

  // ── Prefetch de todos los datos en cuanto el usuario hace login ──
  useEffect(() => {
    if (!user) return
    queryClient.prefetchQuery({ queryKey: QUERY_KEYS.solicitudes, queryFn: fetchSolicitudes, staleTime: STALE_TIMES.solicitudes })
    queryClient.prefetchQuery({ queryKey: QUERY_KEYS.clientes,    queryFn: fetchClientes,    staleTime: STALE_TIMES.clientes    })
    queryClient.prefetchQuery({ queryKey: QUERY_KEYS.usuarios,    queryFn: fetchUsuarios,    staleTime: STALE_TIMES.usuarios    })
    queryClient.prefetchQuery({ queryKey: QUERY_KEYS.bitacora,    queryFn: fetchBitacora,    staleTime: STALE_TIMES.bitacora    })
  }, [user, queryClient])

  // ── Navegación ────────────────────────────────────────
  const navigate = useCallback((s: string) => {
    if (s === 'logout') { logout(); return }
    setStep(s as FlowStep)
  }, [setStep, logout])

  // ── Flujo rápido: mesero genera factura directamente ──
  function handleGenerarFactura(o: CurrentOrder) {
    const { date, time } = { date: new Date().toLocaleDateString('es-MX'), time: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) }
    setLlevarData({
      mesa: o.mesa,
      monto: o.monto,
      tipoPago: o.tipoPago,
      mesero: o.mesero,
      fecha: date,
      hora: time,
      negocio: o.negocio,
      exp: Date.now() + 5 * 24 * 60 * 60 * 1000,
    })
  }

  function handleClienteDone(c: ClienteFormData, isNewClient: boolean) {
    setCliente(c)
    setIsNew(isNewClient)
    setStep('confirm')
  }

  function handleConfirm() {
    if (!order || !cliente) return
    setStep('success')
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
          negocio:       order.negocio,
        })
      } catch {
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

  // ── Render: panel del despacho contable ────────────────────
  if (isDespacho) {
    return (
      <div className="font-sans antialiased text-white h-dvh overflow-hidden">
        <DespachoPage />
        <ReloadPrompt />
      </div>
    )
  }

  // ── Render: link "para llevar" (formulario público, sin login) ──
  if (llevarData) {
    return (
      <div className="font-sans antialiased text-white h-dvh overflow-hidden">
        <LlevarPage data={llevarData} />
        <ReloadPrompt />
      </div>
    )
  }

  // ── Render: link expirado ──────────────────────────────────
  if (llevarExpired) {
    return (
      <div className="font-sans antialiased text-white h-dvh overflow-hidden bg-bg flex flex-col items-center justify-center px-6 text-center">
        <img src={LOGO} alt="Logo" className="h-20 w-auto object-contain mb-6" />
        <span className="text-5xl mb-4">⏰</span>
        <h1 className="text-xl font-bold text-white mb-2">Link expirado</h1>
        <p className="text-muted text-sm max-w-[280px]">
          Este link de facturación ya no es válido. Los links expiran después de 5 días.
        </p>
        <p className="text-muted text-xs mt-4">
          Pide a tu mesero que genere un nuevo link.
        </p>
      </div>
    )
  }

  // ── Render: flujo normal (con auth) ────────────────────────
  return (
    <div className="font-sans antialiased text-white h-dvh overflow-hidden">
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
                onGenerarFactura={handleGenerarFactura}
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

            {step === 'despacho' && (
              <DespachoPage onBack={() => setStep('admin')} />
            )}
          </motion.div>
        </AnimatePresence>

        <LoadingOverlay />
        <ToastContainer toasts={toasts} dismiss={dismiss} />
        <ReloadPrompt />
      </div>
  )
}
