// ── BottomNav — Speed Dial FAB: un botón ☰ que despliega items
// en DOS columnas hacia arriba con AnimatePresence

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../auth/AuthContext'

interface NavItem {
  label:    string
  icon:     string
  step:     string
  roles?:   string[] // si undefined = todos
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Nueva Solicitud', icon: '🧾', step: 'mesero' },
  { label: 'Inicio',          icon: '🏠', step: 'home'   },
  { label: 'Panel Admin',     icon: '⚙️', step: 'admin',  roles: ['admin', 'contable'] },
  { label: 'Cerrar Sesión',   icon: '🚪', step: 'logout'  },
]

interface BottomNavProps {
  onNavigate: (step: string) => void
}

export function BottomNav({ onNavigate }: BottomNavProps) {
  const [open, setOpen] = useState(false)
  const { user } = useAuth()

  const items = NAV_ITEMS.filter(
    (i) => !i.roles || (user && i.roles.includes(user.rol)),
  )

  // Dividir en dos columnas
  const col1 = items.filter((_, i) => i % 2 === 0)
  const col2 = items.filter((_, i) => i % 2 !== 0)

  function handleSelect(step: string) {
    setOpen(false)
    onNavigate(step)
  }

  return (
    <>
      {/* Overlay de cierre */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-20"
            onClick={() => setOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* FAB + items */}
      <div className="fixed bottom-5 right-5 z-30 flex flex-col items-end gap-2">
        {/* Items desplegables en dos columnas */}
        <AnimatePresence>
          {open && (
            <motion.div
              key="items"
              initial={{ opacity: 0, scale: 0.9, y: 12 }}
              animate={{ opacity: 1, scale: 1,   y: 0  }}
              exit={{    opacity: 0, scale: 0.9, y: 12 }}
              transition={{ type: 'spring', damping: 22, stiffness: 320 }}
              className="grid grid-cols-2 gap-2 mb-1"
            >
              {[col1, col2].map((col, ci) =>
                col.map((item, ri) => (
                  <motion.button
                    key={item.step}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: (ci + ri) * 0.04 }}
                    onClick={() => handleSelect(item.step)}
                    className="
                      flex flex-col items-center gap-1
                      bg-surface border border-white/10
                      rounded-xl px-4 py-3
                      text-xs font-semibold text-white
                      shadow-lg whitespace-nowrap
                      active:scale-95 transition-transform
                    "
                  >
                    <span className="text-xl">{item.icon}</span>
                    {item.label}
                  </motion.button>
                )),
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* FAB principal */}
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={() => setOpen((o) => !o)}
          className="w-14 h-14 rounded-full bg-accent text-white text-2xl shadow-xl flex items-center justify-center"
          aria-label="Menú de navegación"
        >
          <motion.span
            animate={{ rotate: open ? 45 : 0 }}
            transition={{ duration: 0.2 }}
            className="leading-none"
          >
            ☰
          </motion.span>
        </motion.button>
      </div>
    </>
  )
}
