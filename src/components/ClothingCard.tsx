import { useState, useEffect, useRef } from 'react'
import type { ClothingItem, UserCloset } from '../types'
import { getImages } from '../types'
import Menu from './Menu'
import type { MenuItem } from './Menu'

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
  const lbTouchStartX = useRef(0)
  const lbDidSwipe = useRef(false)

  useEffect(() => { setImgIndex(0) }, [item.id])
  useEffect(() => {
    setImgIndex(i => Math.min(i, Math.max(0, images.length - 1)))
  }, [images.length])
  useEffect(() => {
    if (autoOpen) setLightbox(true)
  }, [autoOpen])

  useEffect(() => {
    if (!lightbox) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(false)
      if (e.key === 'ArrowRight' && multi) setImgIndex(i => (i + 1) % images.length)
      if (e.key === 'ArrowLeft' && multi) setImgIndex(i => (i - 1 + images.length) % images.length)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox, multi, images.length])

  const menuItems: MenuItem[] = []
  if (onShare) menuItems.push({ label: 'Copy link', onClick: onShare })
  if (isOwner) {
    menuItems.push({ label: 'Edit', onClick: () => onEdit(item) })
    if (onTransfer && otherClosets.length > 0) menuItems.push({ label: 'Transfer', onClick: () => setShowTransfer(t => !t) })
    menuItems.push({ label: 'Delete', danger: true, onClick: () => onDelete(item.id) })
  }

  const currentImg = images[imgIndex] ?? ''

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
                <span key={i} className={`w-1.5 h-1.5 rounded-full transition-colors ${i === imgIndex ? 'bg-white' : 'bg-white/40'}`} />
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
        <div
          className="fixed inset-0 bg-black/85 flex flex-col items-center justify-center z-[200] p-6 gap-3"
          style={{ cursor: 'zoom-out' }}
          onTouchStart={e => { lbTouchStartX.current = e.touches[0].clientX; lbDidSwipe.current = false }}
          onTouchEnd={e => {
            const delta = lbTouchStartX.current - e.changedTouches[0].clientX
            if (multi && Math.abs(delta) > 40) {
              lbDidSwipe.current = true
              setImgIndex(i => delta > 0 ? (i + 1) % images.length : (i - 1 + images.length) % images.length)
            }
          }}
          onClick={() => { if (!lbDidSwipe.current) setLightbox(false) }}
        >
          <img
            src={images[imgIndex]}
            alt={item.name}
            className="max-w-full object-contain rounded"
            style={{ maxHeight: multi ? 'calc(100vh - 7rem)' : 'calc(100vh - 4rem)' }}
          />
          {item.notes && <p className="text-white/70 text-sm">{item.notes}</p>}
          {multi && (
            <div className="absolute bottom-5 left-0 right-0 flex justify-center" onClick={e => e.stopPropagation()}>
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setImgIndex(i)}
                  className="p-2 flex items-center justify-center"
                >
                  <span className={`block w-2 h-2 rounded-full transition-colors ${i === imgIndex ? 'bg-white' : 'bg-white/40'}`} />
                </button>
              ))}
            </div>
          )}
          {multi && (
            <>
              <button
                className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-black/40 rounded-full text-white leading-none"
                style={{ fontSize: 28 }}
                onClick={e => { e.stopPropagation(); setImgIndex(i => (i - 1 + images.length) % images.length) }}
              >‹</button>
              <button
                className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-black/40 rounded-full text-white leading-none"
                style={{ fontSize: 28 }}
                onClick={e => { e.stopPropagation(); setImgIndex(i => (i + 1) % images.length) }}
              >›</button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
