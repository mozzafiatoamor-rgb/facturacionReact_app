// ============================================================
// SETUPSCREEN.TSX — Configuración inicial
// Sheet ID + API Key + Apps Script URL
// ============================================================

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from './AuthContext'
import type { AppConfig } from '../api/types'
import { useToast } from '../hooks/useToast'
import { LOGO } from '../assets/logo'

export function SetupScreen() {
  const { config, saveConfig } = useAuth()
  const { toast } = useToast()

  const [sheetId,   setSheetId  ] = useState(config?.sheetId   ?? '')
  const [apiKey,    setApiKey   ] = useState(config?.apiKey    ?? '')
  const [scriptUrl, setScriptUrl] = useState(config?.scriptUrl ?? '')

  function handleSave() {
    const s = sheetId.trim()
    const a = apiKey.trim()
    const u = scriptUrl.trim()
    if (!s || !a || !u) {
      toast('Completa todos los campos', 'error')
      return
    }
    const cfg: AppConfig = { sheetId: s, apiKey: a, scriptUrl: u }
    saveConfig(cfg)
    toast('✅ Configuración guardada')
  }

  return (
    <div className="h-full bg-bg flex flex-col items-center justify-start overflow-y-auto px-4 pt-10 pb-8">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <img src={LOGO} alt="Logo" className="h-16 w-auto mx-auto mb-3 object-contain" />
        <h1 className="text-center text-xl font-bold mb-1 text-white">
          Mozzafiato Facturas
        </h1>
        <p className="text-center text-sm text-muted mb-6">
          Configura la conexión con Google Sheets
        </p>

        {/* Card */}
        <div className="bg-surface border border-white/10 rounded-xl p-5 mb-4">
          <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-4">
            Configuración
          </p>

          <Field label="ID del Spreadsheet">
            <input
              value={sheetId}
              onChange={(e) => setSheetId(e.target.value)}
              placeholder="1BxiMVs0XRA5nFMdKvBd..."
              autoComplete="off"
              spellCheck={false}
              className="input"
            />
          </Field>

          <Field label="API Key (Google Sheets)">
            <input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIzaSy..."
              autoComplete="off"
              spellCheck={false}
              className="input"
            />
          </Field>

          <Field label="URL del Apps Script (doPost)" last>
            <input
              value={scriptUrl}
              onChange={(e) => setScriptUrl(e.target.value)}
              placeholder="https://script.google.com/macros/s/..."
              type="url"
              autoComplete="off"
              spellCheck={false}
              className="input"
            />
          </Field>

          <button onClick={handleSave} className="btn btn-primary w-full mt-2">
            Guardar y Continuar
          </button>
        </div>

        <p className="text-center text-xs text-muted leading-relaxed">
          Hojas requeridas en el Spreadsheet:
          <br />
          <span className="text-white font-semibold">
            👥 Clientes · 🧾 Solicitudes · 👤 Usuarios · 📜 Bitácora
          </span>
        </p>
      </motion.div>
    </div>
  )
}

function Field({
  label,
  children,
  last,
}: {
  label: string
  children: React.ReactNode
  last?: boolean
}) {
  return (
    <div className={last ? '' : 'mb-3'}>
      <label className="block text-xs text-muted font-medium mb-1.5">
        {label}
      </label>
      {children}
    </div>
  )
}
