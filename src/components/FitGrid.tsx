import { useState } from 'react'
import type { Fit, FitItem } from '../types'
import type { PendingFit } from '../contexts/fitGenerationContext'
import type { ToastVariant } from './Toast'
import Menu from './Menu'
import ShareButton from './ShareButton'
import Lightbox from './Lightbox'
import Spinner from './Spinner'

// Row of item thumbnails shown under a fit/pending card; with onSelect each thumb opens that item.
function Thumbs({ items, onSelect }: { items: FitItem[]; onSelect?: (item: FitItem) => void }) {
  return (
    <>
      {items.slice(0, 5).map(item => {
        const img = <img src={item.imageUrl} alt={item.name} className="w-6 h-6 object-contain" />
        const key = `${item.slug}-${item.itemId}`
        return onSelect
          ? <button key={key} onClick={() => onSelect(item)} title={item.name} className="shrink-0 cursor-zoom-in">{img}</button>
          : <span key={key} className="shrink-0">{img}</span>
      })}
      {items.length > 5 && <span className="text-[10px] text-(--muted) self-center">+{items.length - 5}</span>}
    </>
  )
}

type Props = {
  fits: Fit[]
  pending: PendingFit[]            // standalone (no existingId) — shown as loading cards
  regeneratingIds: Set<string>     // fit ids with a spinner overlay (regenerate in flight)
  isOwner: boolean
  openFitId?: string               // deep-link: open this fit's lightbox once (id prefix, e.g. ?fit=)
  onEdit: (fit: Fit) => void
  onDelete: (fit: Fit) => void
  showToast: (msg: string, variant?: ToastVariant) => void
}

// Shared fit grid + lightboxes for /fits and the suitcase detail page. Owns only the lightbox
// view state; the fit list, generation, and edit/delete handlers stay with the parent page.
export default function FitGrid({ fits, pending, regeneratingIds, isOwner, openFitId, onEdit, onDelete, showToast }: Props) {
  const [lightboxFit, setLightboxFit] = useState<Fit | null>(null)
  const [lightboxItem, setLightboxItem] = useState<FitItem | null>(null)

  function shareFit(fit: Fit) {
    // Suitcase fits are siloed to their suitcase page; standalone fits live on /fits.
    // Full id (not a prefix) so the unscoped ?id= lookup stays exact/non-enumerable.
    const path = fit.suitcaseId ? `/suitcases/${fit.suitcaseId}` : '/fits'
    navigator.clipboard.writeText(`${window.location.origin}${path}?fit=${fit.id}`)
    showToast('Link copied!')
  }

  // Open the deep-linked fit as soon as it's in the list, and only that once — marking the id
  // consumed during render keeps reopening off the table when the list refreshes behind the user.
  const [consumedFitId, setConsumedFitId] = useState<string | null>(null)
  if (openFitId && openFitId !== consumedFitId) {
    const match = fits.find(f => f.id.startsWith(openFitId))
    if (match) {
      setConsumedFitId(openFitId)
      setLightboxFit(match)
    }
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
        {pending.map(p => (
          <div key={p.jobId} className="flex flex-col">
            <div className="relative aspect-square overflow-hidden flex items-center justify-center card-fill">
              <Spinner size={28} />
            </div>
            <div className="pt-1 px-0.5 flex flex-col gap-0.5">
              {p.name && <div className="text-xs text-(--text) truncate">{p.name}</div>}
              <div className="flex gap-1 overflow-hidden"><Thumbs items={p.items} /></div>
            </div>
          </div>
        ))}
        {fits.map(fit => (
          <div key={fit.id} className="flex flex-col">
            <button onClick={() => setLightboxFit(fit)} className="relative block aspect-square cursor-zoom-in overflow-hidden card-fill">
              <img src={fit.imageUrl} alt={fit.name} className="w-full h-full object-cover" />
              {regeneratingIds.has(fit.id) && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <Spinner size={28} light />
                </div>
              )}
            </button>
            <div className="pt-1 px-0.5 flex flex-col gap-0.5">
              <div className="flex items-center justify-between gap-1">
                <button onClick={() => setLightboxFit(fit)} className="text-xs text-(--text) truncate text-left min-w-0 flex-1">
                  {fit.name}
                </button>
                {isOwner && (
                  <div className="-my-1.5"><Menu
                    items={[
                      { label: 'Edit', onClick: () => onEdit(fit) },
                      { label: 'Delete', danger: true, onClick: () => { onDelete(fit); setLightboxFit(f => (f?.id === fit.id ? null : f)) } },
                    ]}
                  /></div>
                )}
              </div>
              <div className="flex items-center justify-between gap-1">
                <div className="flex gap-1 overflow-hidden min-w-0 flex-1">
                  <Thumbs items={fit.items} onSelect={setLightboxItem} />
                </div>
                <ShareButton onShare={() => shareFit(fit)} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {lightboxFit && (
        <Lightbox
          images={[lightboxFit.imageUrl]}
          name={lightboxFit.name}
          zIndex={300}
          closeOnEsc={!lightboxItem}
          onShare={() => shareFit(lightboxFit)}
          onClose={() => setLightboxFit(null)}
        >
          <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1 max-w-lg">
            {lightboxFit.items.map(item => (
              <button key={`${item.slug}-${item.itemId}`} onClick={() => setLightboxItem(item)} className="shrink-0 flex flex-col items-center gap-1" title={item.name}>
                <img src={item.imageUrl} alt={item.name} className="w-14 h-14 object-contain card-fill" />
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
    </>
  )
}
