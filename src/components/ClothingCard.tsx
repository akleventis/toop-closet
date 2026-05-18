import { useState, useEffect } from 'react'
import type { ClothingItem, UserCloset } from '../types'
import Menu from './Menu'

type Props = {
  item: ClothingItem
  isOwner: boolean
  isProcessing?: boolean
  otherClosets?: UserCloset[]
  onEdit: (item: ClothingItem) => void
  onDelete: (id: string) => void
  onTransfer?: (item: ClothingItem, targetSlug: string) => Promise<void>
}

export default function ClothingCard({ item, isOwner, isProcessing, otherClosets = [], onEdit, onDelete, onTransfer }: Props) {
  const [lightbox, setLightbox] = useState(false)
  const [showTransfer, setShowTransfer] = useState(false)
  const [transferring, setTransferring] = useState(false)

  useEffect(() => {
    if (!lightbox) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setLightbox(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox])

  const menuItems = [
    { label: 'Edit', onClick: () => onEdit(item) },
    ...(onTransfer && otherClosets.length > 0 ? [{ label: 'Transfer', onClick: () => setShowTransfer(t => !t) }] : []),
    { label: 'Delete', danger: true, onClick: () => onDelete(item.id) },
  ]

  return (
    <div className="bg-[--bg-subtle] border border-[--border] rounded-lg flex flex-col">
      <div className="w-full aspect-[4/3] overflow-hidden bg-[--border] relative rounded-t-lg">
        {item.imageUrl ? (
          <>
            <img
              src={item.imageUrl}
              alt={item.name}
              className="w-full h-full object-contain cursor-zoom-in"
              onClick={isProcessing ? undefined : () => setLightbox(true)}
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
      </div>
      <div className="p-3 flex flex-col gap-1.5 flex-1">
        <div className="flex items-start justify-between gap-1">
          <div className="font-semibold text-sm">{item.name}</div>
          {isOwner && <Menu items={menuItems} />}
        </div>
        <span className="self-start text-[10px] font-semibold px-1.5 py-0.5 rounded border border-[--border] text-[--muted] uppercase tracking-[0.05em]">
          {item.category}
        </span>
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
          className="fixed inset-0 bg-black/85 flex flex-col items-center justify-center z-[200] p-6 cursor-zoom-out gap-3"
          onClick={() => setLightbox(false)}
        >
          <img
            src={item.imageUrl}
            alt={item.name}
            className="max-w-full max-h-full object-contain rounded"
          />
          {item.notes && (
            <p className="text-white/70 text-sm">{item.notes}</p>
          )}
        </div>
      )}
    </div>
  )
}
