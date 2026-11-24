// -my-2 keeps the 32px tap target without making its row taller; -mr-1.5 centers the icon under the ⋮
export default function ShareButton({ onShare }: { onShare: () => void }) {
  return (
    <button
      aria-label="Share"
      onClick={e => { e.stopPropagation(); onShare() }}
      className="w-8 h-8 -my-2 -mr-1.5 flex items-center justify-center text-(--muted) hover:text-(--text) transition-colors shrink-0"
      style={{ touchAction: 'manipulation' }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
      </svg>
    </button>
  )
}
