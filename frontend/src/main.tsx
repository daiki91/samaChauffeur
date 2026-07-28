// Set React Router future flags early to silence v7 warnings
;(window as any).__RR_FUTURE_FLAGS__ = { v7_startTransition: true, v7_relativeSplatPath: true }

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initAuth } from './lib/auth'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './components/Toasts'

initAuth()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </AuthProvider>
  </StrictMode>,
)
