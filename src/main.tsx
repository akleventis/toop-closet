import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import App from './App'

function RootRedirect() {
  return <Navigate to={`/toop${window.location.hash}`} replace />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/:slug" element={<App />} />
        <Route path="/" element={<RootRedirect />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
