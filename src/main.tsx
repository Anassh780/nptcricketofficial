import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { enablePwaInstallCapture } from './lib/pwaInstall'

enablePwaInstallCapture()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js', { scope: '/' }).then((registration) => registration.update())
  })
}
