import { useState, useRef, useEffect } from 'react'

export type MenuItem = {
  label: string
  danger?: boolean
  onClick: () => void
}

export default function Menu({ items, align = 'right' }: { items: MenuItem[]; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-8 h-8 flex items-center justify-center rounded text-[--muted] hover:text-[--text] transition-colors text-base leading-none"
        style={{ touchAction: 'manipulation' }}
      >
        ⋮
      </button>
      {open && (
        <div className={`absolute top-full mt-1 ${align === 'left' ? 'left-0' : 'right-0'} border border-[--border] rounded shadow-md z-50 w-max py-1`} style={{ backgroundColor: 'var(--bg)' }}>
          {items.map(item => (
            <button
              key={item.label}
              onClick={() => { setOpen(false); item.onClick() }}
              onMouseEnter={() => setHovered(item.label)}
              onMouseLeave={() => setHovered(null)}
              onTouchStart={() => setHovered(item.label)}
              onTouchEnd={() => setHovered(null)}
              onTouchCancel={() => setHovered(null)}
              className={`block w-full text-left px-3 py-1.5 text-xs whitespace-nowrap transition-colors ${item.danger ? 'text-[--danger]' : 'text-[--text]'}`}
              style={{ backgroundColor: hovered === item.label ? 'var(--bg-subtle)' : undefined }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
