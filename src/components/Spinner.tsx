// Reusable circular loader: an SVG arc on a faint track; `light` flips colors for dark overlays.
export default function Spinner({ size = 24, light = false }: { size?: number; light?: boolean }) {
  const track = light ? 'rgba(255,255,255,0.25)' : 'var(--border)'
  const arc = light ? '#fff' : 'var(--text)'
  return (
    <svg
      className="animate-spin"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      role="status"
      aria-label="Loading"
    >
      <circle cx="12" cy="12" r="9" stroke={track} strokeWidth="2.5" />
      <path d="M12 3a9 9 0 0 1 9 9" stroke={arc} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}
