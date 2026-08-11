// ============================================================
// LOGOS.TS — Logos por negocio
// Vite resuelve las rutas en tiempo de build
// Ambos archivos deben existir en src/assets/
// deploy.yml copia placeholder si logo-regina.png no existe
// ============================================================

import mozzafiatoLogo from './logo.png'
import reginaLogo from './logo-regina.png'

export const LOGOS = {
  mozzafiato: mozzafiatoLogo,
  casaregina: reginaLogo,
} as const

export function getLogo(key: string): string {
  return LOGOS[key as keyof typeof LOGOS] ?? LOGOS.mozzafiato
}
