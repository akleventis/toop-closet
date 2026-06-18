import { useState, useRef } from 'react'
import type { ClothingItem, UserCloset } from '../types'
import { getImages } from '../types'
import Menu from './Menu'
import type { MenuItem } from './Menu'
import Lightbox from './Lightbox'

type Props = {
  item: ClothingItem
  isOwner: boolean
  isProcessing?: boolean
  otherClosets?: UserCloset[]
  autoOpen?: boolean
  onEdit: (item: ClothingItem) => void
  onDelete: (id: string) => void
  onTransfer?: (item: ClothingItem, targetSlug: string) => Promise<void>
  onShare?: () => void
}

export default function ClothingCard({ item, isOwner, isProcessing, otherClosets = [], autoOpen, onEdit, onDelete, onTransfer, onShare }: Props) {
  const images = getImages(item)
  const multi = images.length > 1
  const [imgIndex, setImgIndex] = useState(0)
  const [lightbox, setLightbox] = useState(false)
  const [showTransfer, setShowTransfer] = useState(false)
  const [transferring, setTransferring] = useState(false)
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
    if (onTransfer && otherClosets.length > 0) menuItems.push({ label: 'Transfer', onClick: () => setShowTransfer(t => !t) })
    menuItems.push({ label: 'Delete', danger: true, onClick: () => onDelete(item.id) })
  }

  const currentImg = images[safeIndex] ?? ''

  return (
    <div className="bg-[--bg-subtle] border border-[--border] rounded-lg flex flex-col">
      <div
        className="w-full aspect-square overflow-hidden bg-[--border] relative rounded-t-lg"
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
              className="w-full h-full object-cover cursor-zoom-in"
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
            <div className="w-6 h-6 border-2 border-[--muted]/30 border-t-[--text] rounded-full animate-spin" />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-[--muted] text-xs">No photo</div>
        )}

        {multi && !isProcessing && (
          <>
            <button
              className="absolute left-1 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-black/40 rounded-full text-white leading-none"
              style={{ fontSize: 20 }}
              onClick={e => { e.stopPropagation(); setImgIndex(i => (i - 1 + images.length) % images.length) }}
            >‹</button>
            <button
              className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-black/40 rounded-full text-white leading-none"
              style={{ fontSize: 20 }}
              onClick={e => { e.stopPropagation(); setImgIndex(i => (i + 1) % images.length) }}
            >›</button>
            <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1 pointer-events-none">
              {images.map((_, i) => (
                <span key={i} className={`w-1.5 h-1.5 rounded-full transition-colors ${i === safeIndex ? 'bg-white' : 'bg-white/40'}`} />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="p-3 flex flex-col gap-1.5 flex-1">
        <div className="flex items-start justify-between gap-1">
          <div className="font-medium text-xs truncate">{item.name}</div>
          {!isProcessing && menuItems.length > 0 && <Menu items={menuItems} />}
        </div>
        <span className="self-start text-[10px] px-1.5 py-0.5 rounded border border-[--border] text-[--muted]">{item.category}</span>
        {showTransfer && (
          <div className="flex flex-wrap gap-1.5 mt-1" onClick={e => e.stopPropagation()}>
            {otherClosets.map(c => (
              <button
                key={c.slug}
                disabled={transferring}
                onClick={async () => {
                  setTransferring(true)
                  try { await onTransfer?.(item, c.slug) } finally { setTransferring(false); setShowTransfer(false) }
                }}
                className="px-2 py-0.5 border border-[--border] rounded text-xs hover:bg-[--bg-subtle] disabled:opacity-40 transition-colors"
              >
                {transferring ? '…' : `→ ${c.name ?? c.slug}`}
              </button>
            ))}
          </div>
        )}
      </div>

      {lightbox && (
        <Lightbox
          images={images}
          name={item.name}
          notes={item.notes}
          initialIndex={safeIndex}
          onShare={onShare}
          onClose={() => setLightbox(false)}
        />
      )}
    </div>
  )
}
