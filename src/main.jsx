import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './components/common/Toast'
import { initOfflineSync } from './lib/offline'
import './styles/global.css'

// La compilacion de un solo archivo (demo) usa rutas con hash, porque
// no hay servidor que reescriba las rutas hacia index.html.
const singleFile = import.meta.env.VITE_SINGLE_FILE === '1'
const Router = singleFile ? HashRouter : BrowserRouter

initOfflineSync()

if ('serviceWorker' in navigator && import.meta.env.PROD && !singleFile) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Router>
      <AuthProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AuthProvider>
    </Router>
  </React.StrictMode>
)
