import type { CatalogoItem, TipoPago } from './types'

// ── Nombres de hojas en el Spreadsheet
export const SHEET_NAMES = {
  clientes:    '👥 Clientes',
  solicitudes: '🧾 Solicitudes',
  usuarios:    '👤 Usuarios',
  bitacora:    '📜 Bitácora',
} as const

// ── Rangos de lectura
export const SHEET_RANGES = {
  clientes:    `${SHEET_NAMES.clientes}!A2:I5000`,
  solicitudes: `${SHEET_NAMES.solicitudes}!A2:P1000`,
  usuarios:    `${SHEET_NAMES.usuarios}!A2:E50`,
  bitacora:    `${SHEET_NAMES.bitacora}!A2:F500`,
} as const

// ── staleTime por tipo de dato (ms)
export const STALE_TIMES = {
  usuarios:    5 * 60 * 1000,   // 5 min — cambian poco
  solicitudes: 30 * 1000,       // 30 s — alta frecuencia de cambio
  clientes:    2 * 60 * 1000,   // 2 min
  bitacora:    60 * 1000,       // 1 min
} as const

// ── Query keys centralizados
export const QUERY_KEYS = {
  usuarios:    ['usuarios'] as const,
  solicitudes: ['solicitudes'] as const,
  clientes:    ['clientes'] as const,
  bitacora:    ['bitacora'] as const,
} as const

// ── Catálogos SAT
export const REGIMENES: CatalogoItem[] = [
  { clave: '601', desc: 'General de Ley Personas Morales' },
  { clave: '603', desc: 'Personas Morales con Fines no Lucrativos' },
  { clave: '605', desc: 'Sueldos y Salarios e Ingresos Asimilados a Salarios' },
  { clave: '606', desc: 'Arrendamiento' },
  { clave: '607', desc: 'Régimen de Enajenación o Adquisición de Bienes' },
  { clave: '608', desc: 'Demás ingresos' },
  { clave: '610', desc: 'Residentes en el Extranjero sin Establecimiento Permanente' },
  { clave: '611', desc: 'Ingresos por Dividendos (socios y accionistas)' },
  { clave: '612', desc: 'Personas Físicas con Actividades Empresariales y Profesionales' },
  { clave: '614', desc: 'Ingresos por intereses' },
  { clave: '615', desc: 'Régimen de los ingresos por obtención de premios' },
  { clave: '616', desc: 'Sin obligaciones fiscales' },
  { clave: '620', desc: 'Sociedades Cooperativas de Producción' },
  { clave: '621', desc: 'Incorporación Fiscal' },
  { clave: '622', desc: 'Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras' },
  { clave: '623', desc: 'Opcional para Grupos de Sociedades' },
  { clave: '624', desc: 'Coordinados' },
  { clave: '625', desc: 'Actividades Empresariales vía Plataformas Tecnológicas' },
  { clave: '626', desc: 'Régimen Simplificado de Confianza (RESICO)' },
  { clave: '628', desc: 'Hidrocarburos' },
]

export const USOS_CFDI: CatalogoItem[] = [
  { clave: 'G01', desc: 'Adquisición de mercancias' },
  { clave: 'G02', desc: 'Devoluciones, descuentos o bonificaciones' },
  { clave: 'G03', desc: 'Gastos en general' },
  { clave: 'I01', desc: 'Construcciones' },
  { clave: 'I02', desc: 'Mobilario y equipo de oficina por inversiones' },
  { clave: 'I03', desc: 'Equipo de transporte' },
  { clave: 'I04', desc: 'Equipo de computo y accesorios' },
  { clave: 'I05', desc: 'Dados, troqueles, moldes, matrices y herramental' },
  { clave: 'I06', desc: 'Comunicaciones telefónicas' },
  { clave: 'I07', desc: 'Comunicaciones satelitales' },
  { clave: 'I08', desc: 'Otra maquinaria y equipo' },
  { clave: 'D01', desc: 'Honorarios médicos, dentales y gastos hospitalarios' },
  { clave: 'D02', desc: 'Gastos médicos por incapacidad o discapacidad' },
  { clave: 'D03', desc: 'Gastos funerales' },
  { clave: 'D04', desc: 'Donativos' },
  { clave: 'D05', desc: 'Intereses reales por créditos hipotecarios (casa habitación)' },
  { clave: 'D06', desc: 'Aportaciones voluntarias al SAR' },
  { clave: 'D07', desc: 'Primas por seguros de gastos médicos' },
  { clave: 'D08', desc: 'Gastos de transportación escolar obligatoria' },
  { clave: 'D09', desc: 'Depósitos en cuentas para el ahorro y planes de pensiones' },
  { clave: 'D10', desc: 'Pagos por servicios educativos (colegiaturas)' },
  { clave: 'S01', desc: 'Sin efectos fiscales' },
  { clave: 'CP01', desc: 'Pagos' },
  { clave: 'CN01', desc: 'Nómina' },
]

export const TIPOS_PAGO: TipoPago[] = [
  { clave: 'Efectivo',         icon: '💵', label: 'Efectivo' },
  { clave: 'Tarjeta Débito',   icon: '💳', label: 'Tarjeta Débito' },
  { clave: 'Tarjeta Crédito',  icon: '💳', label: 'Tarjeta Crédito' },
  { clave: 'Transferencia',    icon: '📲', label: 'Transferencia' },
]

// ── Mensajes motivacionales del LoadingOverlay
export const LOADING_MESSAGES = [
  'Conectando con el servidor...',
  'Cargando información...',
  'Casi listo...',
  'Sincronizando datos...',
  'Un momento más...',
  'Preparando todo para ti...',
]

// ── Constantes de localStorage
export const STORAGE_KEYS = {
  config:  '_mzf_facturas_config',
  session: '_mzf_facturas_session',
  sync:    '_mzf_facturas_sync',
} as const
