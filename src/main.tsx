import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom'
import './index.css'
import App from './App'
import { fetchClosets } from './api'

function RootRedirect() {
  const navigate = useNavigate()
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    fetchClosets()
      .then(closets => {
        if (closets.length > 0) navigate(`/${closets[0].slug}`, { replace: true })
        else setNotFound(true)
      })
      .catch(() => setNotFound(true))
  }, [navigate])

  if (notFound) return <p style={{ padding: '2rem', color: 'var(--muted)', fontSize: '0.875rem' }}>No closets found.</p>
  return null
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
