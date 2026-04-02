// ============================================================
// CLIENTEPAGE.TSX — Paso 2: Búsqueda RFC + datos fiscales
// Fase 1: solo búsqueda; Fase 2: formulario completo
// ============================================================

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { StatusBar } from '../components/layout/StatusBar'
import { ClienteForm } from '../components/forms/ClienteForm'
import { StepIndicator } from './MeseroPage'
import { useClientes } from '../hooks/useSheets'
import type { Cliente } from '../api/types'
import type { ClienteFormData } from '../components/forms/ClienteForm'
import type { CurrentOrder } from '../api/types'

const STEPS = ['Mesa', 'Cliente', 'Confirmar', 'Listo']

interface ClientePageProps {
  order:         CurrentOrder
  onNext:        (cliente: ClienteFormData, isNew: boolean) => void
  onBack:        () => void
}

export function ClientePage({ order, onNext, onBack }: ClientePageProps) {
  const { data: clientes = [] } = useClientes()

  const [rfcInput,      setRfcInput     ] = useState('')
  const [selectedCliente, setSelected   ] = useState<Cliente | null>(null)
  const [isNew,         setIsNew        ] = useState(false)

  // Sugerencias: filtrar por RFC o razón social
  const suggestions = useMemo(() => {
    const q = rfcInput.trim().toUpperCase()
    if (q.length < 2) return []
    return clientes
      .filter((c) =>
        c.rfc.includes(q) ||
        c.razonSocial.toUpperCase().includes(q),
      )
      .slice(0, 6)
  }, [rfcInput, clientes])

  const noResults = rfcInput.trim().length >= 3 && suggestions.length === 0

  function pickCliente(c: Cliente) {
    setSelected(c)
    setIsNew(false)
  }

  function useAsNew() {
    setSelected({
      id: '', rfc: rfcInput.trim().toUpperCase(), razonSocial: '',
      regimen: '626', usoCfdi: 'G03', email: '', ultimaSol: '',
      telefono: '', codigoPostal: '', _row: -1,
    })
    setIsNew(true)
  }

  function handleFormSubmit(data: ClienteFormData, isNewClient: boolean) {
    onNext(data, isNewClient)
  }

  return (
    <div className="h-full bg-bg flex flex-col">
      <StatusBar
        title="🧾 Datos Fiscales"
        subtitle={`Mesa ${order.mesa} · $${order.monto}`}
        onBack={selectedCliente ? () => setSelected(null) : onBack}
      />

      <div className="flex-1 px-4 pt-5 pb-8 max-w-sm mx-auto w-full overflow-y-auto">
        <StepIndicator current={1} steps={STEPS} />

        <AnimatePresence mode="wait">
          {/* ── Fase 1: Búsqueda de RFC ────────────────── */}
          {!selectedCliente && (
            <motion.div
              key="fase1"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{    opacity: 0, x: -30 }}
              transition={{ duration: 0.22 }}
            >
              <div className="text-center mb-5">
                <h2 className="text-xl font-bold text-white">Buscar Cliente</h2>
                <p className="text-sm text-muted mt-1">RFC o razón social</p>
              </div>

              <div className="bg-surface border border-white/10 rounded-xl p-5">
                <label className="block text-xs text-muted font-medium mb-1.5">RFC del Cliente</label>
                <div className="relative">
                  <input
                    value={rfcInput}
                    onChange={(e) => setRfcInput(e.target.value)}
                    placeholder="Escribe el RFC o razón social..."
                    autoCapitalize="characters"
                    spellCheck={false}
                    className="input w-full"
                  />

                  {/* Autocomplete */}
                  {suggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-surface2 border border-accent/30 border-t-0 rounded-b-xl z-10 max-h-48 overflow-y-auto">
                      {suggestions.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => pickCliente(c)}
                          className="w-full text-left px-4 py-3 border-b border-white/5 last:border-0 hover:bg-surface transition-colors"
                        >
                          <span className="block font-bold text-white text-sm">{c.rfc}</span>
                          <span className="block text-xs text-muted">{c.razonSocial}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {noResults && (
                  <button
                    onClick={useAsNew}
                    className="btn w-full bg-surface2 border border-white/10 text-white mt-3 text-sm"
                  >
                    + Usar "{rfcInput.toUpperCase()}" como nuevo RFC
                  </button>
                )}
              </div>

              <div className="text-center mt-4">
                <button onClick={onBack} className="btn btn-sm bg-surface2 text-muted border border-white/10">
                  ← Cambiar datos de mesa
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Fase 2: Formulario fiscal ──────────────── */}
          {selectedCliente && (
            <motion.div
              key="fase2"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{    opacity: 0, x: -30 }}
              transition={{ duration: 0.22 }}
            >
              <div className="text-center mb-5">
                <h2 className="text-xl font-bold text-white">Datos Fiscales</h2>
                <p className="text-sm text-muted mt-1">
                  {isNew ? 'Nuevo cliente' : 'Editar / confirmar datos'}
                </p>
              </div>

              <div className="bg-surface border border-white/10 rounded-xl p-5">
                <ClienteForm
                  initial={{
                    rfc:          selectedCliente.rfc,
                    razonSocial:  selectedCliente.razonSocial,
                    regimen:      selectedCliente.regimen,
                    usoCfdi:      selectedCliente.usoCfdi,
                    email:        selectedCliente.email,
                    codigoPostal: selectedCliente.codigoPostal,
                    telefono:     selectedCliente.telefono,
                  }}
                  editingId={isNew ? undefined : selectedCliente.id}
                  isNewCliente={isNew}
                  onSubmit={handleFormSubmit}
                  submitLabel="Continuar a Confirmar →"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
