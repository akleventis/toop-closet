import { useState, useRef, useEffect } from 'react'

export type MenuItem = {
  label: string
  danger?: boolean
  onClick: () => void
}

export default function Menu({ items }: { items: MenuItem[] }) {
  const [open, setOpen] = useState(false)
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
        className="w-5 h-5 flex items-center justify-center rounded text-[--muted] hover:text-[--text] hover:bg-[--bg-subtle] transition-colors text-base leading-none"
      >
        ⋮
      </button>
      {open && (
        <div className="absolute top-full mt-1 right-0 border border-[--border] rounded shadow-md z-50 min-w-[140px] py-1" style={{ backgroundColor: 'var(--bg)' }}>
          {items.map(item => (
            <button
              key={item.label}
              onClick={() => { setOpen(false); item.onClick() }}
              className={`w-full text-left px-3 py-1.5 text-sm hover:bg-[--bg-subtle] transition-colors ${item.danger ? 'text-[--danger]' : 'text-[--text]'}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
