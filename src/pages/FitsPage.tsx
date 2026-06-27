import { useState, useEffect } from 'react'
import type { Fit, FitItem } from '../types'
import { fetchFits, deleteFit } from '../api'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import { useFitGeneration } from '../contexts/fitGenerationContext'
import Header from '../components/Header'
import FitBuilder from '../components/FitBuilder'
import FitGrid from '../components/FitGrid'
import Toast from '../components/Toast'

export default function FitsPage() {
  const { user, token, isOwner, userClosets, allClosets, login, logout } = useAuth()
  // Generation/polling lives in the provider above the router, so it keeps running (and toasts
  // its outcome) even after you navigate away from /fits. `pending` survives navigation too.
  const { pending, generate, subscribe } = useFitGeneration()
  const { toast, showToast } = useToast()
  const [fits, setFits] = useState<Fit[]>([])
  const [loading, setLoading] = useState(true)
  const [building, setBuilding] = useState(false)
  const [editingFit, setEditingFit] = useState<Fit | null>(null)
  const [fitParam] = useState(() => new URLSearchParams(window.location.search).get('fit'))

  // Patch the local list when a generation finishes while this page is mounted. If it finishes
  // after we've unmounted, the fit is already persisted server-side and shows up on next fetch.
  useEffect(() => subscribe(({ fit, existingId }) => {
    setFits(prev => (existingId ? prev.map(f => (f.id === fit.id ? fit : f)) : [fit, ...prev]))
  }), [subscribe])

  useEffect(() => {
    fetchFits()
      .then(data => {
        setFits(data)
        setLoading(false)
        if (fitParam) {
          window.history.replaceState({}, '', '/fits')
        }
      })
      .catch(() => setLoading(false))
  }, [fitParam])

  // Generate runs in the provider (above the router): close the builder, show a loading card.
  // The provider persists the fit and toasts the outcome even if we navigate away mid-job.
  const handleGenerate = (name: string | undefined, items: FitItem[], context: string, existingFit?: Fit, stub?: boolean, suitcaseId?: string) => {
    generate(name, items, context, token, existingFit, stub, suitcaseId)
  }

  const handleDelete = async (fit: Fit) => {
    try {
      await deleteFit(fit.id, token)
      setFits(prev => prev.filter(f => f.id !== fit.id))
    } catch {
      showToast('Failed to delete fit.', 'error')
    }
  }

  const standalonePending = pending.filter(p => !p.existingId)
  const regeneratingIds = new Set(pending.filter(p => p.existingId).map(p => p.existingId!))

  // "Back to closets": logged-in user → their own first closet; otherwise the first public closet.
  const backTarget = userClosets[0] ?? allClosets[0]
  const backTo = backTarget ? `/${backTarget.slug}` : '/'

  return (
    <div className="min-h-screen">
      <Header slug="" closets={allClosets} user={user} onLogin={login} onLogout={logout} backTo={backTo} />

      <main className="max-w-4xl mx-auto px-4 pb-12">
        <div className="flex items-center justify-between my-5">
          <h1 className="text-sm font-semibold text-[--text]">Fits</h1>
          {isOwner && (
            <button
              onClick={() => setBuilding(true)}
              className="px-3 py-1.5 bg-[--text] text-[--bg] rounded text-xs font-medium"
            >
              + Create fit
            </button>
          )}
        </div>

        {loading ? (
          <p className="text-[--muted] text-sm text-center mt-16">Loading…</p>
        ) : fits.length === 0 && standalonePending.length === 0 ? (
          <p className="text-[--muted] text-sm text-center mt-16">No fits yet.</p>
        ) : (
          <FitGrid
            fits={fits}
            pending={standalonePending}
            regeneratingIds={regeneratingIds}
            isOwner={isOwner}
            openFitId={fitParam ?? undefined}
            onEdit={setEditingFit}
            onDelete={handleDelete}
            showToast={showToast}
          />
        )}
      </main>

      {building && (
        <FitBuilder
          closets={allClosets}
          token={token}
          onGenerate={handleGenerate}
          onClose={() => setBuilding(false)}
        />
      )}
      {editingFit && (
        <FitBuilder
          closets={allClosets}
          token={token}
          editingFit={editingFit}
          onGenerate={handleGenerate}
          onSaved={updated => { setFits(prev => prev.map(f => f.id === updated.id ? updated : f)); setEditingFit(null) }}
          onClose={() => setEditingFit(null)}
        />
      )}

      {toast && <Toast message={toast.msg} variant={toast.variant} />}
    </div>
  )
}
