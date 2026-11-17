import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)

if ('serviceWorker' in navigator) {
  if (import.meta.env.DEV) {
    void navigator.serviceWorker.getRegistrations().then((regs) => {
      for (const reg of regs) void reg.unregister()
    })
    if ('caches' in window) {
      void caches.keys().then((keys) => {
        for (const k of keys) void caches.delete(k)
      })
    }
  } else {
    window.addEventListener('load', () => {
      void navigator.serviceWorker.register('/sw.js').then(async () => {
        const reg = await navigator.serviceWorker.ready
        const urls = performance.getEntriesByType('resource').map((r) => r.name).filter((u) => u.startsWith(location.origin))
        reg.active?.postMessage({ type: 'CACHE_URLS', urls })
      })
    })
  }
}
