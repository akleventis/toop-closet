import { useState, useEffect } from 'react'
import type { ClothingItem } from '../types'

type Props = {
  item: ClothingItem
  isOwner: boolean
  isProcessing?: boolean
  otherClosets?: string[]
  onEdit: (item: ClothingItem) => void
  onDelete: (id: string) => void
  onTransfer?: (item: ClothingItem, targetSlug: string) => Promise<void>
}

export default function ClothingCard({ item, isOwner, isProcessing, otherClosets = [], onEdit, onDelete, onTransfer }: Props) {
  const [lightbox, setLightbox] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [transferring, setTransferring] = useState(false)
  const [showTransfer, setShowTransfer] = useState(false)

  useEffect(() => {
    if (!lightbox) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setLightbox(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox])

  return (
    <div className="bg-[--bg-subtle] border border-[--border] rounded-lg overflow-hidden flex flex-col">
      <div className="w-full aspect-[4/3] overflow-hidden bg-[--border] relative">
        {item.imageUrl ? (
          <>
            <img
              src={item.imageUrl}
              alt={item.name}
              className="w-full h-full object-cover cursor-zoom-in"
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
      <div
        className="p-3 flex flex-col gap-1.5 flex-1 cursor-pointer"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="font-semibold text-sm">{item.name}</div>
        <span className="self-start text-[10px] font-semibold px-1.5 py-0.5 rounded border border-[--border] text-[--muted] uppercase tracking-[0.05em]">
          {item.category}
        </span>
        {expanded && item.notes && (
          <p className="text-xs text-[--muted] mt-0.5">{item.notes}</p>
        )}
        {isOwner && (
          <div className="flex flex-col gap-1.5 mt-auto pt-2.5" onClick={e => e.stopPropagation()}>
            <div className="flex gap-2">
              <button
                onClick={() => onEdit(item)}
                className="px-2.5 py-0.5 border border-[--border] rounded bg-[--text] text-[--bg] text-xs font-medium hover:opacity-80 transition-opacity"
              >
                Edit
              </button>
              <button
                onClick={() => onDelete(item.id)}
                className="px-2.5 py-0.5 border border-[--danger] rounded text-[--danger] text-xs font-medium hover:bg-[--bg-subtle] transition-colors"
              >
                Delete
              </button>
              {onTransfer && otherClosets.length > 0 && (
                <button
                  onClick={() => setShowTransfer(t => !t)}
                  className="px-2.5 py-0.5 border border-[--border] rounded text-[--muted] text-xs font-medium hover:bg-[--bg-subtle] transition-colors"
                >
                  Transfer
                </button>
              )}
            </div>
            {showTransfer && (
              <div className="flex flex-wrap gap-1.5">
                {otherClosets.map(target => (
                  <button
                    key={target}
                    disabled={transferring}
                    onClick={async () => {
                      setTransferring(true)
                      try { await onTransfer?.(item, target) } finally { setTransferring(false); setShowTransfer(false) }
                    }}
                    className="px-2 py-0.5 border border-[--border] rounded text-xs hover:bg-[--bg-subtle] disabled:opacity-40 transition-colors"
                  >
                    {transferring ? '…' : `→ ${target}`}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 bg-black/85 flex items-center justify-center z-[200] p-6 cursor-zoom-out"
          onClick={() => setLightbox(false)}
        >
          <img
            src={item.imageUrl}
            alt={item.name}
            className="max-w-full max-h-full object-contain rounded"
          />
        </div>
      )}
    </div>
  )
}
