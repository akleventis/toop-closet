import { useState, useEffect } from 'react'
import type { ClothingItem } from '../types'

type Props = {
  item: ClothingItem
  isOwner: boolean
  onEdit: (item: ClothingItem) => void
  onDelete: (id: string) => void
}

export default function ClothingCard({ item, isOwner, onEdit, onDelete }: Props) {
  const [lightbox, setLightbox] = useState(false)

  useEffect(() => {
    if (!lightbox) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setLightbox(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox])

  return (
    <div className="bg-[--bg-subtle] border border-[--border] rounded-lg overflow-hidden flex flex-col">
      <div className="w-full aspect-[4/3] overflow-hidden bg-[--border]">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.name}
            className="w-full h-full object-cover cursor-zoom-in"
            onClick={() => setLightbox(true)}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-[--muted] text-xs">No photo</div>
        )}
      </div>
      <div className="p-3 flex flex-col gap-1.5 flex-1">
        <div className="font-semibold text-sm">{item.name}</div>
        <span className="self-start text-[10px] font-semibold px-1.5 py-0.5 rounded border border-[--border] text-[--muted] uppercase tracking-[0.05em]">
          {item.category}
        </span>
        {isOwner && (
          <div className="flex gap-2 mt-auto pt-2.5">
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
