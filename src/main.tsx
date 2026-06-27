import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App'
import FitsPage from './pages/FitsPage'
import SuitcasesPage from './pages/SuitcasesPage'
import SuitcaseDetailPage from './pages/SuitcaseDetailPage'
import RootRedirect from './pages/RootRedirect'
import { FitGenerationProvider } from './contexts/FitGeneration'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <FitGenerationProvider>
        <Routes>
          <Route path="/fits" element={<FitsPage />} />
          <Route path="/suitcases" element={<SuitcasesPage />} />
          <Route path="/suitcases/:id" element={<SuitcaseDetailPage />} />
          <Route path="/:slug" element={<App />} />
          <Route path="/" element={<RootRedirect />} />
        </Routes>
      </FitGenerationProvider>
    </BrowserRouter>
  </StrictMode>,
)
