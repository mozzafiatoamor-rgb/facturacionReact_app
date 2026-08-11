// ============================================================
// BUSINESSES.TS — Configuración de negocios
// Mozzafiato (restaurante) y Casa Regina (hotel)
// ============================================================

export type NegocioId = 'mozzafiato' | 'casaregina'

export interface Negocio {
  id: NegocioId
  name: string
  folioPrefix: string
  waNumber: string   // con código de país 52
  emoji: string
  color: string      // accent color para diferenciar
  logoKey: 'mozzafiato' | 'casaregina'
}

export const NEGOCIOS: Record<NegocioId, Negocio> = {
  mozzafiato: {
    id: 'mozzafiato',
    name: 'Mozzafiato',
    folioPrefix: 'MOZZ',
    waNumber: '529984088897',
    emoji: '🍕',
    color: '#3b82f6',
    logoKey: 'mozzafiato',
  },
  casaregina: {
    id: 'casaregina',
    name: 'Casa Regina',
    folioPrefix: 'REGINA',
    waNumber: '',  // TODO: agregar número de Casa Regina
    emoji: '🏨',
    color: '#a855f7',
    logoKey: 'casaregina',
  },
}

export const NEGOCIO_LIST = Object.values(NEGOCIOS)

export function getNegocio(id: string): Negocio {
  return NEGOCIOS[id as NegocioId] ?? NEGOCIOS.mozzafiato
}
