import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { API_URL } from './utils/api.js'

// Envia o token de autenticação no header Authorization em todos os pedidos à
// API. Substitui a dependência do cookie, que o browser bloqueia quando o
// frontend e o backend estão em domínios diferentes.
const fetchOriginal = window.fetch.bind(window)
window.fetch = (input, init = {}) => {
  const url = typeof input === 'string' ? input : (input?.url ?? '')
  const token = localStorage.getItem('token')
  if (token && url.startsWith(API_URL)) {
    init = { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` } }
  }
  return fetchOriginal(input, init)
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
