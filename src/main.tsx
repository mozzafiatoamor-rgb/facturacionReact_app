import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './auth/AuthContext'
import App from './App'
import './index.css'

// Service Worker registration (vite-plugin-pwa)
import { registerSW } from 'virtual:pwa-register'

registerSW({
  onNeedRefresh() {
    // Actualización silenciosa — autoUpdate está configurado
  },
  onOfflineReady() {
    console.info('[PWA] App lista para uso offline')
  },
})

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: true,
      refetchOnReconnect:   true,
    },
    mutations: {
      retry: 0, // mutaciones no se reintentan — Dexie se encarga offline
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
