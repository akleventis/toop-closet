import { useState, useEffect, useRef } from 'react'
import type { Fit, FitItem } from '../types'
import type { PendingFit } from '../contexts/fitGenerationContext'
import type { ToastVariant } from './Toast'
import Menu from './Menu'
import Lightbox from './Lightbox'
import Spinner from './Spinner'

// Row of item thumbnails shown under a fit/pending card. Wrap in a <div> or <button> for layout.
function Thumbs({ items }: { items: FitItem[] }) {
  return (
    <>
      {items.slice(0, 5).map(item => (
        <img key={`${item.slug}-${item.itemId}`} src={item.imageUrl} alt={item.name} className="w-6 h-6 rounded object-cover border border-[--border] shrink-0" />
      ))}
      {items.length > 5 && <span className="text-[10px] text-[--muted] self-center">+{items.length - 5}</span>}
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

  // Open the deep-linked fit once, as soon as it's present in the list.
  const opened = useRef(false)
  useEffect(() => {
    if (opened.current || !openFitId) return
    const match = fits.find(f => f.id.startsWith(openFitId))
    // eslint-disable-next-line react-hooks/set-state-in-effect -- open the deep-linked fit once on arrival
    if (match) { setLightboxFit(match); opened.current = true }
  }, [openFitId, fits])

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
        {pending.map(p => (
          <div key={p.tempId} className="rounded-lg border border-[--border] flex flex-col">
            <div className="relative aspect-square bg-[--bg-subtle] rounded-t-lg overflow-hidden flex items-center justify-center">
              <Spinner size={28} />
            </div>
            <div className="p-2.5">
              {p.name && <div className="text-xs font-medium text-[--text] truncate">{p.name}</div>}
              <div className="flex gap-1 mt-1.5 overflow-hidden"><Thumbs items={p.items} /></div>
            </div>
          </div>
        ))}
        {fits.map(fit => (
          <div key={fit.id} className="rounded-lg border border-[--border] hover:border-[--text] transition-colors flex flex-col">
            <button onClick={() => setLightboxFit(fit)} className="relative block aspect-square bg-[--bg-subtle] cursor-zoom-in rounded-t-lg overflow-hidden">
              <img src={fit.imageUrl} alt={fit.name} className="w-full h-full object-cover" />
              {regeneratingIds.has(fit.id) && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <Spinner size={28} light />
                </div>
              )}
            </button>
            <div className="p-2.5">
              <div className="flex items-start justify-between gap-1">
                <button onClick={() => setLightboxFit(fit)} className="text-xs font-medium text-[--text] truncate text-left min-w-0 flex-1">
                  {fit.name}
                </button>
                {isOwner && (
                  <Menu
                    items={[
                      { label: 'Edit', onClick: () => onEdit(fit) },
                      { label: 'Delete', danger: true, onClick: () => { onDelete(fit); setLightboxFit(f => (f?.id === fit.id ? null : f)) } },
                    ]}
                  />
                )}
              </div>
              <button onClick={() => setLightboxFit(fit)} className="flex gap-1 mt-1.5 overflow-hidden w-full">
                <Thumbs items={fit.items} />
              </button>
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
          onShare={() => {
            // Suitcase fits are siloed to their suitcase page; standalone fits live on /fits.
            // Full id (not a prefix) so the unscoped ?id= lookup stays exact/non-enumerable.
            const path = lightboxFit.suitcaseId ? `/suitcases/${lightboxFit.suitcaseId}` : '/fits'
            navigator.clipboard.writeText(`${window.location.origin}${path}?fit=${lightboxFit.id}`)
            showToast('Link copied!')
          }}
          onClose={() => setLightboxFit(null)}
        >
          <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1 max-w-lg">
            {lightboxFit.items.map(item => (
              <button key={`${item.slug}-${item.itemId}`} onClick={() => setLightboxItem(item)} className="shrink-0 flex flex-col items-center gap-1" title={item.name}>
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
    </>
  )
}
