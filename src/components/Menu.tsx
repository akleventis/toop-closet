import { useState } from 'react'
import { useOutsideClick } from '../hooks/useOutsideClick'

export type MenuItem = {
  label: string
  danger?: boolean
  onClick: () => void
}

export default function Menu({ items, align = 'right' }: { items: MenuItem[]; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false)
  const ref = useOutsideClick<HTMLDivElement>(open, () => setOpen(false))
  const actions = items.filter(i => !i.danger)
  const destructive = items.filter(i => i.danger)

  const row = (item: MenuItem) => (
    <button
      key={item.label}
      role="menuitem"
      onClick={() => { setOpen(false); item.onClick() }}
      className={`glass-panel-item ${item.danger ? 'text-(--danger) hover:brightness-125' : 'text-(--muted) hover:text-(--text)'}`}
    >
      {item.label}
    </button>
  )

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="More"
        aria-expanded={open}
        className="w-5 h-8 flex items-center justify-center text-(--muted) hover:text-(--text) transition-colors text-base leading-none"
        style={{ touchAction: 'manipulation' }}
      >
        ⋮
      </button>
      {open && (
        <div
          role="menu"
          className={`glass-panel pop-in absolute top-full mt-1 ${align === 'left' ? 'left-0 origin-top-left' : 'right-0 origin-top-right'}`}
        >
          {actions.map(row)}
          {actions.length > 0 && destructive.length > 0 && <div className="h-px mx-2 my-1 bg-white/10" />}
          {destructive.map(row)}
        </div>
      )}
    </div>
  )
}
