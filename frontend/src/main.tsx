import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter/index.css'
import './index.css'
import { startSync } from '@/sync/syncEngine'
import App from './App.tsx'

// Begin draining the sync queue (startup + on reconnect).
startSync()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
