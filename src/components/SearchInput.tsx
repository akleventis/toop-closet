export default function SearchInput({ value, onChange }: { value: string; onChange: (q: string) => void }) {
  return (
    <div className="relative w-28 shrink-0">
      {/* type="text": "search" adds a native clear button on WebKit that would double ours */}
      <input
        type="text"
        enterKeyHint="search"
        placeholder="Search"
        value={value}
        onChange={e => onChange(e.target.value)}
        className={value ? 'field pr-6' : 'field'}
      />
      {value && (
        <button
          aria-label="Clear search"
          onClick={() => onChange('')}
          className="absolute right-0 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-end pr-2 text-(--muted) hover:text-(--text) transition-colors"
          style={{ touchAction: 'manipulation' }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      )}
    </div>
  )
}
