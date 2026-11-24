import { useState } from 'react'
import type { Workspace } from '../types'
import { useOutsideClick } from '../hooks/useOutsideClick'

const label = (w: Workspace) => w.name ?? (w.own ? 'My workspace' : w.ownerEmail)

// Dropdown to switch the active workspace; render only when the user belongs to >1.
export default function WorkspaceSwitcher({ workspaces, activeWorkspace, onSwitch }: {
  workspaces: Workspace[]
  activeWorkspace?: string | null
  onSwitch: (email: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useOutsideClick<HTMLDivElement>(open, () => setOpen(false))
  const active = workspaces.find(w => w.ownerEmail === activeWorkspace)

  return (
    <div ref={ref} className="relative shrink-0 flex items-center">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-xs font-medium text-(--muted) hover:text-(--text) transition-colors"
        title="Switch workspace"
      >
        <span className="max-w-[72px] sm:max-w-[120px] truncate">{active ? label(active) : 'Workspace'}</span>
        <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <div role="menu" className="glass-panel pop-in absolute top-full mt-1 left-0 origin-top-left">
          {workspaces.map(w => (
            <button
              key={w.ownerEmail}
              onClick={() => { setOpen(false); onSwitch(w.ownerEmail) }}
              role="menuitem"
              className={`glass-panel-item ${w.ownerEmail === activeWorkspace ? 'text-(--text) font-medium' : 'text-(--muted) hover:text-(--text)'}`}
            >
              {label(w)}
            </button>
          ))}
        </div>
      )}
      <span className="w-px h-4 bg-(--border) shrink-0 mx-2" aria-hidden="true" />
    </div>
  )
}
