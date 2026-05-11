import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/:slug" element={<App />} />
        <Route path="/" element={<Navigate to="/toop" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
