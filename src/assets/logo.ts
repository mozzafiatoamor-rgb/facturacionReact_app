// ============================================================
// LOGO.TS — Importación centralizada del logo
// Vite resuelve la ruta en tiempo de build → nunca falla
// Coloca tu logo.png en esta misma carpeta (src/assets/)
// ============================================================

import logoFile from './logo.png'

export const LOGO = logoFile
