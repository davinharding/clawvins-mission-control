import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ToastProvider } from './components/ToastProvider'

const root = document.getElementById('root')

if (!root) {
  throw new Error('Mission Control root element was not found')
}

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <App />
      </ToastProvider>
    </ErrorBoundary>
  </StrictMode>,
)

window.__MC_REACT_MOUNTED__ = true
