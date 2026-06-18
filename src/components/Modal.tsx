import type { ReactNode } from 'react'

// Centered overlay + small dialog panel; click outside closes unless locked.
export default function Modal({ onClose, locked = false, children }: { onClose: () => void; locked?: boolean; children: ReactNode }) {
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4"
      onClick={locked ? undefined : onClose}
    >
      <div
        className="rounded-lg border border-[--border] p-6 w-full max-w-sm flex flex-col gap-4"
        style={{ backgroundColor: 'var(--bg)' }}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
