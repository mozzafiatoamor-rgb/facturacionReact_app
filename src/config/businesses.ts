// ============================================================
// BUSINESSES.TS — Configuración de negocios
// Mozzafiato (restaurante) y Casa Regina (hotel)
// ============================================================

export type NegocioId = 'mozzafiato' | 'casaregina'

export interface NegocioTheme {
  accent: string       // color principal del negocio
  accentDark: string   // hover/activo
  accentLight: string  // fondos suaves (10-20% opacity feel)
  headerBg: string     // fondo del header
  headerText: string   // texto claro del header
}

export interface Negocio {
  id: NegocioId
  name: string
  folioPrefix: string
  waNumber: string   // con código de país 52
  emoji: string
  color: string      // accent color (legacy, usar theme.accent)
  logoKey: 'mozzafiato' | 'casaregina'
  labelMesero: string   // "Mesero" o "Recepcionista"
  labelMesa: string     // "Mesa" o "Habitación"
  theme: NegocioTheme
}

export const NEGOCIOS: Record<NegocioId, Negocio> = {
  mozzafiato: {
    id: 'mozzafiato',
    name: 'Mozzafiato',
    folioPrefix: 'MOZZ',
    waNumber: '529984088897',
    emoji: '🍕',
    color: '#C45C2C',
    logoKey: 'mozzafiato',
    labelMesero: 'Mesero',
    labelMesa: 'Mesa',
    theme: {
      accent: '#C45C2C',       // terracota
      accentDark: '#A34A22',   // terracota oscuro
      accentLight: '#C45C2C1A', // terracota 10%
      headerBg: '#1A120E',     // madera oscura
      headerText: '#F5EDE8',   // crema
    },
  },
  casaregina: {
    id: 'casaregina',
    name: 'Casa Regina',
    folioPrefix: 'REGINA',
    waNumber: '',  // TODO: agregar número de Casa Regina
    emoji: '🏨',
    color: '#C9A84C',
    logoKey: 'casaregina',
    labelMesero: 'Recepcionista',
    labelMesa: 'Habitación',
    theme: {
      accent: '#C9A84C',       // dorado
      accentDark: '#B0923D',   // dorado oscuro
      accentLight: '#C9A84C1A', // dorado 10%
      headerBg: '#0C1F2B',     // azul profundo
      headerText: '#EDE8DA',   // marfil
    },
  },
}

export const NEGOCIO_LIST = Object.values(NEGOCIOS)

export function getNegocio(id: string): Negocio {
  return NEGOCIOS[id as NegocioId] ?? NEGOCIOS.mozzafiato
}
