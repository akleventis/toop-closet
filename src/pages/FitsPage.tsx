import { useState, useEffect } from 'react'
import type { Fit, FitItem } from '../types'
import { fetchFits, deleteFit } from '../api'
import { useAuth } from '../hooks/useAuth'
import { useFitGeneration } from '../contexts/FitGeneration'
import Header from '../components/Header'
import FitBuilder from '../components/FitBuilder'
import Menu from '../components/Menu'
import Lightbox from '../components/Lightbox'
import Spinner from '../components/Spinner'
import Toast from '../components/Toast'
import type { ToastVariant } from '../components/Toast'

export default function FitsPage() {
  const { user, token, isOwner, userClosets, allClosets, login, logout } = useAuth()
  // Generation/polling lives in the provider above the router, so it keeps running (and toasts
  // its outcome) even after you navigate away from /fits. `pending` survives navigation too.
  const { pending, generate, subscribe } = useFitGeneration()
  const [fits, setFits] = useState<Fit[]>([])
  const [loading, setLoading] = useState(true)
  const [building, setBuilding] = useState(false)
  const [editingFit, setEditingFit] = useState<Fit | null>(null)
  const [lightboxFit, setLightboxFit] = useState<Fit | null>(null)
  const [lightboxItem, setLightboxItem] = useState<FitItem | null>(null)
  const [toast, setToast] = useState<{ msg: string; variant: ToastVariant } | null>(null)
  const [fitParam] = useState(() => new URLSearchParams(window.location.search).get('fit'))

  // Patch the local list when a generation finishes while this page is mounted. If it finishes
  // after we've unmounted, the fit is already persisted server-side and shows up on next fetch.
  useEffect(() => subscribe(({ fit, existingId }) => {
    setFits(prev => (existingId ? prev.map(f => (f.id === fit.id ? fit : f)) : [fit, ...prev]))
  }), [subscribe])

  const showToast = (msg: string, variant: ToastVariant = 'success') => {
    setToast({ msg, variant })
    setTimeout(() => setToast(null), variant === 'error' ? 6000 : 2200)
  }

  useEffect(() => {
    fetchFits()
      .then(data => {
        setFits(data)
        setLoading(false)
        if (fitParam) {
          const match = data.find(f => f.id.startsWith(fitParam))
          if (match) setLightboxFit(match)
          window.history.replaceState({}, '', '/fits')
        }
      })
      .catch(() => setLoading(false))
  }, [fitParam])

  // Generate runs in the provider (above the router): close the builder, show a loading card.
  // The provider persists the fit and toasts the outcome even if we navigate away mid-job.
  const handleGenerate = (name: string | undefined, items: FitItem[], context: string, existingFit?: Fit, stub?: boolean) => {
    generate(name, items, context, token, existingFit, stub)
  }

  const handleDelete = async (fit: Fit) => {
    try {
      await deleteFit(fit.id, token)
      setFits(prev => prev.filter(f => f.id !== fit.id))
      setLightboxFit(null)
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
      <Header
        slug=""
        closets={allClosets}
        user={user}
        onLogin={login}
        onLogout={logout}
        backTo={backTo}
      />

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
          <div className="grid grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
            {standalonePending.map(p => (
              <div key={p.tempId} className="rounded-lg border border-[--border] flex flex-col">
                <div className="relative aspect-square bg-[--bg-subtle] rounded-t-lg overflow-hidden flex items-center justify-center">
                  <Spinner size={28} />
                </div>
                <div className="p-2.5">
                  {p.name && <div className="text-xs font-medium text-[--text] truncate">{p.name}</div>}
                  <div className="flex gap-1 mt-1.5 overflow-hidden">
                    {p.items.slice(0, 5).map(item => (
                      <img key={`${item.slug}-${item.itemId}`} src={item.imageUrl} alt={item.name} className="w-6 h-6 rounded object-cover border border-[--border] shrink-0" />
                    ))}
                    {p.items.length > 5 && (
                      <span className="text-[10px] text-[--muted] self-center">+{p.items.length - 5}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {fits.map(fit => (
              <div
                key={fit.id}
                className="rounded-lg border border-[--border] hover:border-[--text] transition-colors flex flex-col"
              >
                <button
                  onClick={() => setLightboxFit(fit)}
                  className="relative block aspect-square bg-[--bg-subtle] cursor-zoom-in rounded-t-lg overflow-hidden"
                >
                  <img src={fit.imageUrl} alt={fit.name} className="w-full h-full object-cover" />
                  {regeneratingIds.has(fit.id) && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <Spinner size={28} light />
                    </div>
                  )}
                </button>
                <div className="p-2.5">
                  <div className="flex items-start justify-between gap-1">
                    <button
                      onClick={() => setLightboxFit(fit)}
                      className="text-xs font-medium text-[--text] truncate text-left min-w-0 flex-1"
                    >
                      {fit.name}
                    </button>
                    {isOwner && (
                      <Menu
                        items={[
                          { label: 'Edit', onClick: () => setEditingFit(fit) },
                          { label: 'Delete', danger: true, onClick: () => handleDelete(fit) },
                        ]}
                      />
                    )}
                  </div>
                  <button
                    onClick={() => setLightboxFit(fit)}
                    className="flex gap-1 mt-1.5 overflow-hidden w-full"
                  >
                    {fit.items.slice(0, 5).map(item => (
                      <img key={`${item.slug}-${item.itemId}`} src={item.imageUrl} alt={item.name} className="w-6 h-6 rounded object-cover border border-[--border] shrink-0" />
                    ))}
                    {fit.items.length > 5 && (
                      <span className="text-[10px] text-[--muted] self-center">+{fit.items.length - 5}</span>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {lightboxFit && (
        <Lightbox
          images={[lightboxFit.imageUrl]}
          name={lightboxFit.name}
          zIndex={300}
          closeOnEsc={!lightboxItem}
          onShare={() => {
            navigator.clipboard.writeText(`${window.location.origin}/fits?fit=${lightboxFit.id.slice(0, 8)}`)
            showToast('Link copied!')
          }}
          onClose={() => setLightboxFit(null)}
        >
          <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1 max-w-lg">
            {lightboxFit.items.map(item => (
              <button
                key={`${item.slug}-${item.itemId}`}
                onClick={() => setLightboxItem(item)}
                className="shrink-0 flex flex-col items-center gap-1"
                title={item.name}
              >
                <img src={item.imageUrl} alt={item.name} className="w-14 h-14 rounded object-cover border border-white/20" />
                <span className="text-[10px] text-white/60 max-w-14 truncate">{item.name}</span>
              </button>
            ))}
          </div>
        </Lightbox>
      )}

      {lightboxItem && (
        <Lightbox
          images={[lightboxItem.imageUrl]}
          name={lightboxItem.name}
          zIndex={350}
          onShare={() => {
            navigator.clipboard.writeText(`${window.location.origin}/${lightboxItem.slug}?item=${lightboxItem.itemId.slice(0, 8)}`)
            showToast('Link copied!')
          }}
          onClose={() => setLightboxItem(null)}
        />
      )}

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
