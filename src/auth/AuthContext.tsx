// ============================================================
// AUTHCONTEXT.TSX — Contexto global de autenticación
// Roles: admin | mesero | contable
// Persiste sesión en localStorage — sobrevive bloqueo de pantalla
// ============================================================

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'
import type { Usuario, AppConfig, FlowStep } from '../api/types'
import { STORAGE_KEYS } from '../api/config'

interface SessionData {
  user: Usuario
  step: FlowStep
}

interface AuthContextValue {
  user: Usuario | null
  config: AppConfig | null
  step: FlowStep
  isAdmin: boolean
  isContable: boolean

  login:      (user: Usuario) => void
  logout:     () => void
  setStep:    (step: FlowStep) => void
  saveConfig: (cfg: AppConfig) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const DEFAULT_CONFIG: AppConfig = { sheetId: '', apiKey: '', scriptUrl: '' }

function loadConfig(): AppConfig | null {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.config) ?? 'null')
  } catch { return null }
}

function loadSession(): SessionData | null {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.session) ?? 'null')
  } catch { return null }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AppConfig | null>(loadConfig)
  const [user,   setUser  ] = useState<Usuario | null>(null)
  const [step,   setStepState] = useState<FlowStep>('setup')

  // Restaurar sesión al montar
  useEffect(() => {
    if (!config) { setStepState('setup'); return }
    const sess = loadSession()
    if (sess?.user) {
      setUser(sess.user)
      setStepState(sess.step ?? 'home')
    } else {
      setStepState('login')
    }
  }, [config])

  // Persistir sesión en cada cambio de step o user
  useEffect(() => {
    if (!user) return
    localStorage.setItem(
      STORAGE_KEYS.session,
      JSON.stringify({ user, step } satisfies SessionData),
    )
  }, [user, step])

  const login = useCallback((u: Usuario) => {
    setUser(u)
    const dest: FlowStep =
      u.rol === 'admin' || u.rol === 'contable' ? 'admin' : 'home'
    setStepState(dest)
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    localStorage.removeItem(STORAGE_KEYS.session)
    setStepState('login')
  }, [])

  const setStep = useCallback((s: FlowStep) => setStepState(s), [])

  const saveConfig = useCallback((cfg: AppConfig) => {
    localStorage.setItem(STORAGE_KEYS.config, JSON.stringify(cfg))
    setConfig(cfg)
    setStepState('login')
  }, [])

  const value: AuthContextValue = {
    user,
    config: config ?? DEFAULT_CONFIG,
    step,
    isAdmin:    user?.rol === 'admin',
    isContable: user?.rol === 'contable',
    login,
    logout,
    setStep,
    saveConfig,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
