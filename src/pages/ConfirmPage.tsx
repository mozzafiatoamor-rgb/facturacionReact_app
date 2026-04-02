// ============================================================
// CONFIRMPAGE.TSX — Paso 3: Resumen completo + botón confirmar
// Cierre optimista: modal de loading NO se muestra; la mutación
// corre en background. La app navega a Success inmediatamente.
// ============================================================

import { motion } from 'framer-motion'
import { StatusBar } from '../components/layout/StatusBar'
import { StepIndicator } from './MeseroPage'
import { fmt$ } from '../utils/dates'
import { REGIMENES, USOS_CFDI, TIPOS_PAGO } from '../api/config'
import type { CurrentOrder } from '../api/types'
import type { ClienteFormData } from '../components/forms/ClienteForm'

const STEPS = ['Mesa', 'Cliente', 'Confirmar', 'Listo']

interface ConfirmPageProps {
  order:       CurrentOrder
  cliente:     ClienteFormData
  isNew:       boolean
  onConfirm:   () => void
  onBack:      () => void
  onEditMesa:  () => void
  onEditCliente: () => void
}

export function ConfirmPage({
  order,
  cliente,
  isNew,
  onConfirm,
  onBack,
  onEditMesa,
  onEditCliente,
}: ConfirmPageProps) {
  const regimenLabel  = REGIMENES.find((r) => r.clave === cliente.regimen)?.desc  ?? cliente.regimen
  const cfdiLabel     = USOS_CFDI.find((u) => u.clave  === cliente.usoCfdi)?.desc ?? cliente.usoCfdi
  const tipoPagoLabel = TIPOS_PAGO.find((t) => t.clave  === order.tipoPago)?.label ?? order.tipoPago

  return (
    <div className="min-h-dvh bg-bg flex flex-col">
      <StatusBar title="✅ Confirmar Solicitud" onBack={onBack} />

      <div className="flex-1 px-4 pt-5 pb-8 max-w-sm mx-auto w-full overflow-y-auto">
        <StepIndicator current={2} steps={STEPS} />

        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25 }}
        >
          {/* Monto destacado */}
          <div className="text-center py-6">
            <p className="text-muted text-sm mb-1">Total a facturar</p>
            <p className="text-4xl font-bold text-white">{fmt$(order.monto)}</p>
            <p className="text-sm text-muted mt-1">Mesa {order.mesa} · {tipoPagoLabel}</p>
          </div>

          {/* Datos de mesa */}
          <Section title="Datos de Mesa" onEdit={onEditMesa}>
            <Row label="Mesa"        value={order.mesa} />
            <Row label="Monto"       value={fmt$(order.monto)} />
            <Row label="Tipo de Pago" value={tipoPagoLabel} />
            {order.notas && <Row label="Notas" value={order.notas} />}
            <Row label="Mesero" value={order.mesero} />
          </Section>

          {/* Datos fiscales */}
          <Section title="Datos Fiscales" onEdit={onEditCliente}>
            {isNew && (
              <div className="bg-info/10 border border-info/20 rounded-lg px-3 py-2 mb-3 text-xs text-info">
                ✨ Nuevo cliente — se registrará automáticamente
              </div>
            )}
            <Row label="RFC"          value={cliente.rfc} />
            <Row label="Razón Social" value={cliente.razonSocial} />
            <Row label="Régimen"      value={`${cliente.regimen} - ${regimenLabel}`} truncate />
            <Row label="Uso CFDI"     value={`${cliente.usoCfdi} - ${cfdiLabel}`} truncate />
            {cliente.email        && <Row label="Email" value={cliente.email} />}
            {cliente.codigoPostal && <Row label="C.P."  value={cliente.codigoPostal} />}
          </Section>

          {/* Botón confirmar */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onConfirm}
            className="btn btn-primary w-full text-base py-4 mt-2"
          >
            Confirmar Solicitud ✓
          </motion.button>

          <p className="text-center text-xs text-muted mt-3">
            La solicitud se enviará a facturación automáticamente
          </p>
        </motion.div>
      </div>
    </div>
  )
}

// ── Sub-componentes ─────────────────────────────────────────

function Section({
  title,
  onEdit,
  children,
}: {
  title:    string
  onEdit?:  () => void
  children: React.ReactNode
}) {
  return (
    <div className="bg-surface border border-white/10 rounded-xl p-4 mb-3">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-muted uppercase tracking-wider">{title}</p>
        {onEdit && (
          <button onClick={onEdit} className="text-xs text-accent font-medium">
            Editar
          </button>
        )}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function Row({ label, value, truncate }: { label: string; value: string; truncate?: boolean }) {
  return (
    <div className="flex justify-between items-start gap-3 text-sm">
      <span className="text-muted flex-shrink-0">{label}</span>
      <span className={`text-white font-medium text-right ${truncate ? 'truncate max-w-[60%]' : ''}`}>
        {value}
      </span>
    </div>
  )
}
