import { useState, useRef } from 'react'
import type { ClothingItem, UserCloset } from '../types'
import { getImages } from '../types'
import { fetchConfig } from '../api'
import Menu from './Menu'
import ShareButton from './ShareButton'
import type { MenuItem } from './Menu'
import Lightbox from './Lightbox'
import Chevron from './Chevron'

type Props = {
  item: ClothingItem
  isOwner: boolean
  isProcessing?: boolean
  otherClosets?: UserCloset[]
  autoOpen?: boolean
  onEdit: (item: ClothingItem) => void
  onDelete: (id: string) => void
  onTransfer?: (item: ClothingItem, targetSlug: string, category: string) => Promise<void>
  onRetryBg?: (item: ClothingItem) => void
  onShare?: () => void
}

export default function ClothingCard({ item, isOwner, isProcessing, otherClosets = [], autoOpen, onEdit, onDelete, onTransfer, onRetryBg, onShare }: Props) {
  const images = getImages(item)
  const multi = images.length > 1
  const [imgIndex, setImgIndex] = useState(0)
  const [lightbox, setLightbox] = useState(!!autoOpen)
  const [showTransfer, setShowTransfer] = useState(false)
  const [transferring, setTransferring] = useState(false)
  // Second transfer step: which target closet + one of its tags to file under.
  const [target, setTarget] = useState<{ slug: string; name?: string; categories: string[] } | null>(null)
  const [targetCat, setTargetCat] = useState('')
  const [loadingTarget, setLoadingTarget] = useState<string | null>(null)
  const [transferError, setTransferError] = useState(false)
  const touchStartX = useRef(0)
  const didSwipe = useRef(false)

  // Adjust state during render instead of in effects — avoids cascading re-renders.
  const [prevId, setPrevId] = useState(item.id)
  if (item.id !== prevId) {
    setPrevId(item.id)
    setImgIndex(0)            // reset carousel when the item itself changes
  }
  const [prevAutoOpen, setPrevAutoOpen] = useState(autoOpen)
  if (autoOpen !== prevAutoOpen) {
    setPrevAutoOpen(autoOpen)
    if (autoOpen) setLightbox(true)
  }
  // Clamp is derived, not stored — covers an image being removed while viewing.
  const safeIndex = Math.min(imgIndex, Math.max(0, images.length - 1))

  const menuItems: MenuItem[] = []
  if (isOwner) {
    menuItems.push({ label: 'Edit', onClick: () => onEdit(item) })
    if (onRetryBg && item.bgError && !isProcessing) menuItems.push({ label: 'Retry background removal', onClick: () => onRetryBg(item) })
    if (onTransfer && otherClosets.length > 0) menuItems.push({ label: 'Transfer', onClick: () => setShowTransfer(t => { if (t) setTarget(null); return !t }) })
    menuItems.push({ label: 'Delete', danger: true, onClick: () => onDelete(item.id) })
  }

  const currentImg = images[safeIndex] ?? ''

  return (
    <div className="flex flex-col">
      <div
        className="w-full aspect-square overflow-hidden relative card-fill"
        onTouchStart={e => { touchStartX.current = e.touches[0].clientX; didSwipe.current = false }}
        onTouchEnd={e => {
          const delta = touchStartX.current - e.changedTouches[0].clientX
          if (multi && Math.abs(delta) > 40) {
            didSwipe.current = true
            setImgIndex(i => delta > 0 ? (i + 1) % images.length : (i - 1 + images.length) % images.length)
          }
        }}
      >
        {currentImg ? (
          <>
            <img
              src={currentImg}
              alt={item.name}
              className="w-full h-full object-contain p-1.5 cursor-zoom-in"
              onClick={isProcessing ? undefined : () => { if (!didSwipe.current) setLightbox(true) }}
            />
            {isProcessing && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              </div>
            )}
          </>
        ) : isProcessing ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-6 h-6 border-2 border-(--muted)/30 border-t-(--text) rounded-full animate-spin" />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-(--muted) text-xs">No photo</div>
        )}

        {multi && !isProcessing && (
          <>
            <button
              aria-label="Previous photo"
              className="absolute left-0 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-(--muted) hover:text-(--text) transition-colors"
              onClick={e => { e.stopPropagation(); setImgIndex(i => (i - 1 + images.length) % images.length) }}
            ><Chevron dir="left" size={14} /></button>
            <button
              aria-label="Next photo"
              className="absolute right-0 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-(--muted) hover:text-(--text) transition-colors"
              onClick={e => { e.stopPropagation(); setImgIndex(i => (i + 1) % images.length) }}
            ><Chevron dir="right" size={14} /></button>
            <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1 pointer-events-none">
              {images.map((_, i) => (
                <span key={i} className={`w-1.5 h-1.5 rounded-full transition-colors ${i === safeIndex ? 'bg-white' : 'bg-white/40'}`} />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="pt-1 px-0.5 flex flex-col gap-0.5 flex-1">
        <div className="flex items-center justify-between gap-1">
          <div className="text-xs truncate">{item.name}</div>
          {!isProcessing && menuItems.length > 0 && <div className="-my-1.5"><Menu items={menuItems} /></div>}
        </div>
        <div className="flex items-center justify-between gap-1">
          <span className="text-[10px] text-(--muted) truncate">{item.category}</span>
          {onShare && <ShareButton onShare={onShare} />}
        </div>
        {showTransfer && !target && (
          <div className="flex flex-wrap gap-1.5 mt-1" onClick={e => e.stopPropagation()}>
            {otherClosets.map(c => (
              <button
                key={c.slug}
                disabled={!!loadingTarget}
                onClick={async () => {
                  setLoadingTarget(c.slug)
                  setTransferError(false)
                  try {
                    const cfg = await fetchConfig(c.slug)
                    setTarget({ slug: c.slug, name: c.name, categories: cfg.categories })
                    setTargetCat(cfg.categories[0] ?? '')
                  } catch { setTransferError(true) }
                  finally { setLoadingTarget(null) }
                }}
                className="btn px-2 py-0.5"
              >
                {loadingTarget === c.slug ? '…' : `→ ${c.name ?? c.slug}`}
              </button>
            ))}
            {transferError && <span className="text-(--danger) text-[10px] w-full">Couldn't load tags. Try again.</span>}
          </div>
        )}
        {showTransfer && target && (
          <div className="flex flex-col gap-1.5 mt-1" onClick={e => e.stopPropagation()}>
            <span className="text-[10px] text-(--muted) truncate">Tag in {target.name ?? target.slug}</span>
            <div className="flex items-center gap-1.5">
              <select
                value={targetCat}
                onChange={e => setTargetCat(e.target.value)}
                disabled={transferring}
                className="field flex-1 min-w-0"
              >
                {target.categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <button
                disabled={transferring || !targetCat}
                onClick={async () => {
                  setTransferring(true)
                  try { await onTransfer?.(item, target.slug, targetCat) }
                  finally { setTransferring(false); setShowTransfer(false); setTarget(null) }
                }}
                className="btn px-2 py-0.5 shrink-0"
              >
                {transferring ? '…' : 'Move'}
              </button>
            </div>
          </div>
        )}
      </div>

      {lightbox && (
        <Lightbox
          images={images}
          name={item.name}
          initialIndex={safeIndex}
          onShare={onShare}
          onClose={() => setLightbox(false)}
        />
      )}
    </div>
  )
}
