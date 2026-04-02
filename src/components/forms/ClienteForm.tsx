// ============================================================
// CLIENTEFORM.TSX — Formulario de datos fiscales del cliente
// Detección de duplicados en 2 niveles (exacto + similar)
// Cierre optimista: modal se cierra antes de confirmar el POST
// ============================================================

import { useState, useMemo } from 'react'
import { useClientes } from '../../hooks/useSheets'
import { normalize, hasSimilarKeywords } from '../../utils/ids'
import { REGIMENES, USOS_CFDI } from '../../api/config'
import type { Cliente } from '../../api/types'

export interface ClienteFormData {
  rfc:          string
  razonSocial:  string
  regimen:      string
  usoCfdi:      string
  email:        string
  codigoPostal: string
  telefono:     string
}

interface ClienteFormProps {
  initial?:         Partial<ClienteFormData>
  editingId?:       string   // excluir de búsqueda de duplicados (modo edición)
  isNewCliente?:    boolean
  onSubmit:         (data: ClienteFormData, isNew: boolean) => void
  onRfcSearch?:     (rfc: string) => void   // callback cuando RFC cambia (fase 1)
  submitLabel?:     string
}

const EMPTY: ClienteFormData = {
  rfc: '', razonSocial: '', regimen: '626', usoCfdi: 'G03',
  email: '', codigoPostal: '', telefono: '',
}

export function ClienteForm({
  initial,
  editingId,
  isNewCliente,
  onSubmit,
  submitLabel = 'Continuar →',
}: ClienteFormProps) {
  const { data: clientes = [] } = useClientes()

  const [form, setForm] = useState<ClienteFormData>({ ...EMPTY, ...initial })
  const [errors, setErrors] = useState<Partial<Record<keyof ClienteFormData, string>>>({})
  const [selectedSuggestion, setSelectedSuggestion] = useState<Cliente | null>(null)

  function set<K extends keyof ClienteFormData>(key: K, val: string) {
    setForm((f) => ({ ...f, [key]: val }))
    setErrors((e) => ({ ...e, [key]: '' }))
    if (key === 'razonSocial') setSelectedSuggestion(null)
  }

  // ── Detección de duplicados ────────────────────────────
  const { exactMatch, similarMatches } = useMemo(() => {
    const rs = form.razonSocial.trim()
    // Exacto: mínimo 3 chars. Similar: mínimo 6 chars para evitar falsos positivos
    if (!rs || rs.length < 3) return { exactMatch: null, similarMatches: [] }

    const candidates = clientes.filter((c) => c.id !== editingId)

    const exact = candidates.find(
      (c) => normalize(c.razonSocial) === normalize(rs),
    ) ?? null

    const similar = exact || rs.length < 6
      ? []
      : candidates
          .filter((c) => hasSimilarKeywords(c.razonSocial, rs))
          .slice(0, 5)

    return { exactMatch: exact, similarMatches: similar }
  }, [form.razonSocial, clientes, editingId])

  // Bloqueo si hay duplicado exacto o se seleccionó una sugerencia
  const isBlocked =
    (exactMatch !== null) ||
    (selectedSuggestion !== null && normalize(form.razonSocial) === normalize(selectedSuggestion.razonSocial))

  // ── Validación ─────────────────────────────────────────
  function validate(): boolean {
    const e: Partial<Record<keyof ClienteFormData, string>> = {}
    if (!form.rfc.trim())         e.rfc         = 'RFC requerido'
    if (!form.razonSocial.trim()) e.razonSocial  = 'Razón social requerida'
    if (!form.regimen)            e.regimen      = 'Régimen requerido'
    if (!form.usoCfdi)            e.usoCfdi      = 'Uso CFDI requerido'
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      e.email = 'Email inválido'
    }

    // Guard final contra duplicados (aunque el usuario evite el dropdown)
    const exact = clientes.find(
      (c) => c.id !== editingId && normalize(c.razonSocial) === normalize(form.razonSocial),
    )
    if (exact) {
      e.razonSocial = `Duplicado exacto: ${exact.razonSocial} (${exact.rfc})`
    }

    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    onSubmit({ ...form, rfc: form.rfc.toUpperCase() }, isNewCliente ?? false)
  }

  function selectSuggestion(c: Cliente) {
    setSelectedSuggestion(c)
    setForm((f) => ({
      ...f,
      rfc:          c.rfc,
      razonSocial:  c.razonSocial,
      regimen:      c.regimen,
      usoCfdi:      c.usoCfdi,
      email:        c.email,
      codigoPostal: c.codigoPostal,
      telefono:     c.telefono,
    }))
    setErrors({})
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* Nuevo cliente banner */}
      {isNewCliente && (
        <div className="bg-info/10 border border-info/30 rounded-lg px-3 py-2 text-xs text-info">
          ✨ Nuevo cliente — sus datos se guardarán automáticamente
        </div>
      )}

      {/* RFC */}
      <Field label="RFC" error={errors.rfc}>
        <input
          value={form.rfc}
          onChange={(e) => set('rfc', e.target.value)}
          placeholder="XAXX010101000"
          autoCapitalize="characters"
          spellCheck={false}
          className="input"
        />
      </Field>

      {/* Razón Social con detección de duplicados */}
      <Field label="Razón Social / Nombre" error={errors.razonSocial}>
        <input
          value={form.razonSocial}
          onChange={(e) => set('razonSocial', e.target.value)}
          placeholder="Empresa SA de CV"
          className={`input ${
            exactMatch || (selectedSuggestion && isBlocked)
              ? 'border-danger'
              : similarMatches.length > 0
              ? 'border-warning'
              : ''
          }`}
        />

        {/* Nivel 1: duplicado exacto → bloqueo rojo */}
        {exactMatch && (
          <p className="text-xs text-danger mt-1 flex items-center gap-1">
            🚫 Ya existe: <strong>{exactMatch.razonSocial}</strong> ({exactMatch.rfc})
          </p>
        )}

        {/* Nivel 2: similares → sugerencias */}
        {!exactMatch && similarMatches.length > 0 && (
          <div className="mt-1 border border-warning/40 rounded-lg overflow-hidden">
            <p className="text-xs text-warning px-3 py-1.5 bg-warning/5 border-b border-warning/20">
              ⚠️ Posibles duplicados — selecciona si es el mismo cliente:
            </p>
            {similarMatches.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => selectSuggestion(c)}
                className="w-full text-left px-3 py-2 text-sm border-b border-white/5 last:border-0 hover:bg-surface2 transition-colors"
              >
                <span className="font-semibold text-white">{c.rfc}</span>
                <span className="text-muted ml-2 text-xs">{c.razonSocial}</span>
              </button>
            ))}
          </div>
        )}

        {/* Aviso de sugerencia seleccionada bloqueada */}
        {selectedSuggestion && isBlocked && (
          <p className="text-xs text-warning mt-1">
            ⚠️ Cliente existente seleccionado. Escribe un nombre diferente para registrar uno nuevo.
          </p>
        )}
      </Field>

      {/* Régimen Fiscal */}
      <Field label="Régimen Fiscal" error={errors.regimen}>
        <select
          value={form.regimen}
          onChange={(e) => set('regimen', e.target.value)}
          className="input"
        >
          <option value="">Seleccionar...</option>
          {REGIMENES.map((r) => (
            <option key={r.clave} value={r.clave}>
              {r.clave} - {r.desc}
            </option>
          ))}
        </select>
      </Field>

      {/* Uso CFDI */}
      <Field label="Uso CFDI" error={errors.usoCfdi}>
        <select
          value={form.usoCfdi}
          onChange={(e) => set('usoCfdi', e.target.value)}
          className="input"
        >
          <option value="">Seleccionar...</option>
          {USOS_CFDI.map((u) => (
            <option key={u.clave} value={u.clave}>
              {u.clave} - {u.desc}
            </option>
          ))}
        </select>
      </Field>

      {/* Email */}
      <Field label="Email (para confirmación)" error={errors.email}>
        <input
          value={form.email}
          onChange={(e) => set('email', e.target.value)}
          type="email"
          inputMode="email"
          placeholder="cliente@email.com"
          className="input"
        />
      </Field>

      {/* CP + Teléfono en row */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="C.P." error={errors.codigoPostal}>
          <input
            value={form.codigoPostal}
            onChange={(e) => set('codigoPostal', e.target.value)}
            inputMode="numeric"
            placeholder="64000"
            className="input"
          />
        </Field>
        <Field label="Teléfono" error={errors.telefono}>
          <input
            value={form.telefono}
            onChange={(e) => set('telefono', e.target.value)}
            type="tel"
            inputMode="tel"
            placeholder="81 0000 0000"
            className="input"
          />
        </Field>
      </div>

      <button
        type="submit"
        disabled={isBlocked}
        className="btn btn-primary w-full mt-2 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {submitLabel}
      </button>
    </form>
  )
}

// ── Sub-componente Field ───────────────────────────────────
function Field({
  label,
  error,
  children,
}: {
  label:    string
  error?:   string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-xs text-muted font-medium mb-1.5">{label}</label>
      {children}
      {error && <p className="text-xs text-danger mt-1">{error}</p>}
    </div>
  )
}
