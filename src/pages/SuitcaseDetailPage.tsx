import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import type { Fit, FitItem, Suitcase } from '../types'
import { fetchSuitcases, fetchFits, updateSuitcase, deleteFit } from '../api'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import { useFitGeneration } from '../contexts/fitGenerationContext'
import Header from '../components/Header'
import FitBuilder from '../components/FitBuilder'
import FitGrid from '../components/FitGrid'
import Lightbox from '../components/Lightbox'
import Toast from '../components/Toast'

export default function SuitcaseDetailPage() {
  const { id = '' } = useParams<{ id: string }>()
  const { user, token, isOwner, userClosets, allClosets, login, logout } = useAuth()
  const { pending, generate, subscribe } = useFitGeneration()
  const { toast, showToast } = useToast()
  const [suitcase, setSuitcase] = useState<Suitcase | null>(null)
  const [fits, setFits] = useState<Fit[]>([])
  const [loading, setLoading] = useState(true)
  const [building, setBuilding] = useState(false)
  const [packing, setPacking] = useState(false)
  const [editingFit, setEditingFit] = useState<Fit | null>(null)
  const [lightboxItem, setLightboxItem] = useState<FitItem | null>(null)

  // Patch the local fit list when a generation for THIS suitcase finishes while mounted.
  useEffect(() => subscribe(({ fit, existingId }) => {
    if (existingId) setFits(prev => prev.map(f => (f.id === fit.id ? fit : f)))
    else if (fit.suitcaseId === id) setFits(prev => [fit, ...prev])
  }), [subscribe, id])

  useEffect(() => {
    Promise.all([fetchSuitcases(), fetchFits()])
      .then(([suitcases, allFits]) => {
        setSuitcase(suitcases.find(s => s.id === id) ?? null)
        setFits(allFits.filter(f => f.suitcaseId === id))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  const handleGenerate = (name: string | undefined, items: FitItem[], context: string, existingFit?: Fit, stub?: boolean, suitcaseId?: string) => {
    generate(name, items, context, token, existingFit, stub, suitcaseId)
  }

  const handleUnpack = async (item: FitItem) => {
    if (!suitcase) return
    const items = suitcase.items.filter(i => !(i.itemId === item.itemId && i.slug === item.slug))
    setSuitcase({ ...suitcase, items })
    try {
      await updateSuitcase(suitcase.id, { items }, token)
    } catch {
      setSuitcase(suitcase) // revert
      showToast('Failed to remove item.', 'error')
    }
  }

  // Pack picker (FitBuilder pack mode) saves the selected items as the suitcase's packed set.
  const handlePackItems = async (items: FitItem[]) => {
    if (!suitcase) return
    const updated = await updateSuitcase(suitcase.id, { items }, token)
    setSuitcase(updated)
  }

  const handleDeleteFit = async (fit: Fit) => {
    try {
      await deleteFit(fit.id, token)
      setFits(prev => prev.filter(f => f.id !== fit.id))
    } catch {
      showToast('Failed to delete fit.', 'error')
    }
  }

  const standalonePending = pending.filter(p => !p.existingId && p.suitcaseId === id)
  const regeneratingIds = new Set(pending.filter(p => p.existingId && p.suitcaseId === id).map(p => p.existingId!))

  const backTarget = userClosets[0] ?? allClosets[0]
  const backTo = backTarget ? `/${backTarget.slug}` : '/'

  return (
    <div className="min-h-screen">
      <Header slug="" closets={allClosets} user={user} onLogin={login} onLogout={logout} backTo={backTo} />

      <main className="max-w-4xl mx-auto px-4 pb-12">
        {loading ? (
          <p className="text-[--muted] text-sm text-center mt-16">Loading…</p>
        ) : !suitcase ? (
          <p className="text-[--muted] text-sm text-center mt-16">
            Suitcase not found. <Link to="/suitcases" className="underline">Back to suitcases</Link>
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between my-5 gap-3">
              <h1 className="text-sm font-semibold text-[--text] truncate">{suitcase.name ?? 'Untitled suitcase'}</h1>
              <Link to="/suitcases" className="text-xs text-[--muted] hover:text-[--text] transition-colors shrink-0">All suitcases</Link>
            </div>

            {/* Packed items */}
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-medium text-[--muted]">Packed ({suitcase.items.length})</h2>
              {isOwner && (
                <button
                  onClick={() => setPacking(true)}
                  className="px-3 py-1.5 bg-[--text] text-[--bg] rounded text-xs font-medium"
                >
                  Pack items
                </button>
              )}
            </div>
            {suitcase.items.length === 0 ? (
              <p className="text-[--muted] text-xs">Nothing packed yet — tap "Pack items" to add clothes from your closets.</p>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {suitcase.items.map(item => (
                  <div key={`${item.slug}-${item.itemId}`} className="flex flex-col gap-0.5">
                    <div className="relative aspect-square">
                      <button onClick={() => setLightboxItem(item)} className="block w-full h-full rounded overflow-hidden border border-[--border] cursor-zoom-in">
                        <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                      </button>
                      {isOwner && (
                        <button
                          onClick={() => handleUnpack(item)}
                          className="absolute -top-1 -right-1 bg-[--text] text-[--bg] rounded-full w-4 h-4 flex items-center justify-center text-[10px] leading-none"
                          title="Remove from suitcase"
                        >
                          ×
                        </button>
                      )}
                    </div>
                    <span className="text-[9px] text-[--muted] truncate text-center">{item.name}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Fits */}
            <div className="flex items-center justify-between mt-8 mb-2">
              <h2 className="text-xs font-medium text-[--muted]">Fits</h2>
              {isOwner && (
                <button
                  onClick={() => setBuilding(true)}
                  disabled={suitcase.items.length === 0}
                  className="px-3 py-1.5 bg-[--text] text-[--bg] rounded text-xs font-medium disabled:opacity-40"
                  title={suitcase.items.length === 0 ? 'Pack some items first' : undefined}
                >
                  + Generate fit
                </button>
              )}
            </div>

            {fits.length === 0 && standalonePending.length === 0 ? (
              <p className="text-[--muted] text-xs">No fits from this suitcase yet.</p>
            ) : (
              <FitGrid
                fits={fits}
                pending={standalonePending}
                regeneratingIds={regeneratingIds}
                isOwner={isOwner}
                onEdit={setEditingFit}
                onDelete={handleDeleteFit}
                showToast={showToast}
              />
            )}
          </>
        )}
      </main>

      {/* Packed-item viewer (the fit grid manages its own lightboxes internally). */}
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

      {packing && suitcase && (
        <FitBuilder
          closets={allClosets}
          token={token}
          packMode
          initialItems={suitcase.items}
          onAddItems={handlePackItems}
          onClose={() => setPacking(false)}
        />
      )}
      {building && suitcase && (
        <FitBuilder
          closets={allClosets}
          token={token}
          pool={suitcase.items}
          suitcaseId={suitcase.id}
          onGenerate={handleGenerate}
          onClose={() => setBuilding(false)}
        />
      )}
      {editingFit && suitcase && (
        <FitBuilder
          closets={allClosets}
          token={token}
          pool={suitcase.items}
          suitcaseId={suitcase.id}
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
