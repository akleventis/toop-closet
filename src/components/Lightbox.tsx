import { useState, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import Chevron from './Chevron'

type Props = {
  images: string[]
  name?: string
  initialIndex?: number
  zIndex?: number
  closeOnEsc?: boolean
  onShare?: () => void
  onClose: () => void
  children?: ReactNode
}

export default function Lightbox({ images, name, initialIndex = 0, zIndex = 200, closeOnEsc = true, onShare, onClose, children }: Props) {
  const multi = images.length > 1
  const [index, setIndex] = useState(initialIndex)
  const touchStartX = useRef(0)
  const didSwipe = useRef(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closeOnEsc) onClose()
      if (e.key === 'ArrowRight' && multi) setIndex(i => (i + 1) % images.length)
      if (e.key === 'ArrowLeft' && multi) setIndex(i => (i - 1 + images.length) % images.length)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [multi, images.length, closeOnEsc, onClose])

  return (
    <div
      className="fixed inset-0 bg-black/85 flex flex-col items-center justify-center p-6 gap-3"
      style={{ cursor: 'zoom-out', zIndex }}
      onTouchStart={e => { touchStartX.current = e.touches[0].clientX; didSwipe.current = false }}
      onTouchEnd={e => {
        const delta = touchStartX.current - e.changedTouches[0].clientX
        if (multi && Math.abs(delta) > 40) {
          didSwipe.current = true
          setIndex(i => delta > 0 ? (i + 1) % images.length : (i - 1 + images.length) % images.length)
        }
      }}
      onClick={() => { if (!didSwipe.current) onClose() }}
    >
      {onShare && (
        <button
          onClick={e => { e.stopPropagation(); onShare() }}
          className="btn absolute top-4 right-4"
        >
          Share
        </button>
      )}

      <img
        src={images[index]}
        alt={name}
        className="max-w-full object-contain min-h-0"
        style={{ maxHeight: children ? 'calc(100vh - 15rem)' : multi ? 'calc(100vh - 9rem)' : 'calc(100vh - 6rem)' }}
      />
      {name && <p className="text-white/90 text-sm">{name}</p>}
      {children && <div onClick={e => e.stopPropagation()}>{children}</div>}

      {multi && (
        <div className="absolute bottom-5 left-0 right-0 flex justify-center" onClick={e => e.stopPropagation()}>
          {images.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className="p-2 flex items-center justify-center"
            >
              <span className={`block w-2 h-2 rounded-full transition-colors ${i === index ? 'bg-white' : 'bg-white/40'}`} />
            </button>
          ))}
        </div>
      )}
      {multi && (
        <>
          <button
            aria-label="Previous photo"
            className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-(--muted) hover:text-(--text) transition-colors"
            onClick={e => { e.stopPropagation(); setIndex(i => (i - 1 + images.length) % images.length) }}
          ><Chevron dir="left" size={22} /></button>
          <button
            aria-label="Next photo"
            className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-(--muted) hover:text-(--text) transition-colors"
            onClick={e => { e.stopPropagation(); setIndex(i => (i + 1) % images.length) }}
          ><Chevron dir="right" size={22} /></button>
        </>
      )}
    </div>
  )
}
