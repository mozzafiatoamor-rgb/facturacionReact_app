import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './auth/AuthContext'
import App from './App'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      // Mantener datos en caché 10 min después de que el componente desmonte
      // → navegar atrás/adelante NO re-fetcha si los datos son frescos
      gcTime: 10 * 60 * 1000,
      // No re-fetch al volver al foco si los datos son recientes
      // (evita re-fetch innecesario cuando el mesero cambia de app y vuelve)
      refetchOnWindowFocus: false,
      refetchOnReconnect:   true,
    },
    mutations: {
      retry: 0,
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
