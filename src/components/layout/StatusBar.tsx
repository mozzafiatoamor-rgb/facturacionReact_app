// ── StatusBar — Header sticky con logo + usuario + conexión

import { useAuth } from '../../auth/AuthContext'
import { useGlobalFetching } from '../../hooks/useSheets'

const B = import.meta.env.BASE_URL
const LOGO = `${B}logo.png`
const LOGO_FB = `${B}icon-192.png`

interface StatusBarProps {
  title?: string
  subtitle?: string
  onBack?: () => void
  action?: React.ReactNode
}

export function StatusBar({ title, subtitle, onBack, action }: StatusBarProps) {
  const { user } = useAuth()
  const isFetching = useGlobalFetching()

  return (
    <header className="bg-surface border-b border-white/10 px-4 py-3 flex items-center gap-3 sticky top-0 z-30">
      {onBack && (
        <button
          onClick={onBack}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-surface2 text-muted text-lg flex-shrink-0"
          aria-label="Volver"
        >
          ‹
        </button>
      )}

      {!onBack && (
        <img
          src={LOGO}
          alt="Logo"
          className="h-7 w-auto object-contain flex-shrink-0"
          onError={(e) => {
            const el = e.currentTarget as HTMLImageElement
            if (el.getAttribute('src') !== LOGO_FB) {
              el.setAttribute('src', LOGO_FB)
            } else {
              el.outerHTML = '<span class="text-xl">🧾</span>'
            }
          }}
        />
      )}

      <div className="flex-1 min-w-0">
        {title && (
          <p className="text-sm font-bold text-white leading-tight truncate">{title}</p>
        )}
        {subtitle && (
          <p className="text-xs text-muted leading-tight truncate">{subtitle}</p>
        )}
        {!title && user && (
          <p className="text-sm font-semibold text-white truncate">
            Mozzafiato Facturas
          </p>
        )}
        {!subtitle && user && (
          <p className="text-xs text-muted truncate">{user.nombre}</p>
        )}
      </div>

      {action}

      {/* Dot de conexión/fetching */}
      <span
        className={`w-2.5 h-2.5 rounded-full flex-shrink-0 transition-colors ${
          isFetching ? 'bg-warning animate-pulse' : 'bg-success'
        }`}
        title={isFetching ? 'Sincronizando...' : 'Conectado'}
      />
    </header>
  )
}
