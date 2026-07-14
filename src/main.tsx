import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Register Service Worker for GitHub Pages (adds COOP/COEP headers)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/goku/sw.js', { scope: '/goku/' }).then((reg) => {
    if (reg.installing) {
      reg.installing.addEventListener('statechange', (e) => {
        if ((e.target as ServiceWorker).state === 'activated') {
          window.location.reload();
        }
      });
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
