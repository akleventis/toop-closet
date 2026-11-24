import type { ReactNode } from 'react'

// Centered overlay + small dialog panel; click outside closes unless locked.
export default function Modal({ onClose, locked = false, children }: { onClose: () => void; locked?: boolean; children: ReactNode }) {
  return (
    <div
      className="scrim z-[200]"
      onClick={locked ? undefined : onClose}
    >
      <div
        className="sheet p-5 max-w-sm flex flex-col gap-4"
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
