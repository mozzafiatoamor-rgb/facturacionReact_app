// ============================================================
// TIPOS CENTRALES — Mozzafiato Facturas
// Fuente única de verdad para todas las interfaces y tipos
// ============================================================

// ── Configuración de la app (persiste en localStorage)
export interface AppConfig {
  sheetId: string
  apiKey: string
  scriptUrl: string
}

// ── Roles de usuario
export type UserRole = 'admin' | 'mesero' | 'contable'

// ── Usuario (hoja 👤 Usuarios)
export interface Usuario {
  id: string          // Col A
  nombre: string      // Col B
  pin: string         // Col C
  rol: UserRole       // Col D
  activo: boolean     // Col E
  _row: number        // fila en Sheet (para deletes/updates)
}

// ── Cliente (hoja 👥 Clientes)
export interface Cliente {
  id: string          // Col A
  rfc: string         // Col B
  razonSocial: string // Col C
  regimen: string     // Col D — solo clave (ej: "626")
  usoCfdi: string     // Col E — solo clave (ej: "G03")
  email: string       // Col F
  ultimaSol: string   // Col G — fecha última solicitud
  telefono: string    // Col H
  codigoPostal: string// Col I
  _row: number
}

// ── Status de solicitud
export type SolicitudStatus = 'Pendiente' | 'Procesada' | 'Cancelada'

// ── Solicitud de factura (hoja 🧾 Solicitudes)
export interface Solicitud {
  id: string              // Col A
  fecha: string           // Col B — DD/MM/YYYY
  hora: string            // Col C — HH:MM
  mesa: string            // Col D
  monto: string           // Col E
  tipoPago: string        // Col F
  rfc: string             // Col G
  razonSocial: string     // Col H
  regimen: string         // Col I — solo clave
  usoCfdi: string         // Col J — solo clave
  email: string           // Col K
  status: SolicitudStatus // Col L
  mesero: string          // Col M
  notas: string           // Col N
  codigoPostal: string    // Col O
  _row: number
  // Campo virtual para optimistic UI
  _optimistic?: boolean
}

// ── Entrada de bitácora (hoja 📜 Bitácora)
export interface BitacoraEntry {
  fecha: string     // Col A
  hora: string      // Col B
  usuario: string   // Col C
  accion: string    // Col D
  detalle: string   // Col E
  tipo: string      // Col F
  _row: number
}

// ── Payload que se envía al Apps Script
export interface AppScriptPayload {
  action: 'append' | 'delete' | 'update' | 'updateStatus' | 'updateCliente' | 'sendConfirmation' | 'batchAppend'
  [key: string]: unknown
}

// ── Item para batchAppend
export interface BatchItem {
  sheet: string
  rows: string[][]
}

// ── Operación pendiente en cola offline (Dexie)
export interface PendingOperation {
  id?: number          // auto-increment (Dexie)
  type: 'append' | 'updateStatus' | 'updateCliente' | 'sendConfirmation' | 'batchAppend'
  sheet?: string
  values?: string[]
  solId?: string
  status?: string
  notas?: string
  rfc?: string
  data?: Partial<Cliente>
  items?: BatchItem[]
  emailData?: EmailData
  createdAt: number    // timestamp para retry logic
  retries: number
}

// ── Datos del email de confirmación
export interface EmailData {
  to: string
  solId: string
  mesa: string
  monto: string
  rfc: string
  razonSocial: string
}

// ── Tipos de toast
export type ToastType = 'success' | 'error' | 'info'

export interface ToastMessage {
  id: number
  message: string
  type: ToastType
}

// ── Paso del flujo de solicitud
export type FlowStep = 'setup' | 'login' | 'home' | 'mesero' | 'cliente' | 'confirm' | 'success' | 'admin'

// ── Datos del paso mesero (orden en curso)
export interface CurrentOrder {
  mesa: string
  monto: string
  tipoPago: string
  notas: string
  mesero: string
}

// ── Catálogo SAT
export interface CatalogoItem {
  clave: string
  desc: string
}

export interface TipoPago {
  clave: string
  icon: string
  label: string
}

// ── Filtros para admin
export type FilterStatus = 'all' | SolicitudStatus
export type AdminTab = 'solicitudes' | 'clientes' | 'bitacora'
