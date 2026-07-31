import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const BASE = process.env.VITE_BASE_URL ?? '/'

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png', 'icon-maskable.png', 'logo.png'],
      manifest: {
        name: 'Mozzafiato Facturas',
        short_name: 'Facturas',
        description: 'Sistema de solicitudes de facturación para Mozzafiato',
        theme_color: '#0e1726',
        background_color: '#0e1726',
        display: 'standalone',
        orientation: 'portrait',
        scope: BASE,
        start_url: BASE,
        prefer_related_applications: false,
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icon-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // NetworkFirst para lecturas de Google Sheets
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/sheets\.googleapis\.com\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'sheets-api-cache',
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 50, maxAgeSeconds: 300 },
            },
          },
          // NetworkOnly para Apps Script (escrituras — nunca desde caché)
          {
            urlPattern: /^https:\/\/script\.google\.com\//,
            handler: 'NetworkOnly',
          },
        ],
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        skipWaiting: true,
        clientsClaim: true,
      },
      devOptions: { enabled: false },
    }),
  ],
})
