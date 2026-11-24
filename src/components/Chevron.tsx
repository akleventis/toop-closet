// drop shadow keeps the white chevron readable over light clothing
export default function Chevron({ dir, size }: { dir: 'left' | 'right'; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="drop-shadow-[0_1px_2px_rgb(0_0_0/0.6)]">
      <path d={dir === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
    </svg>
  )
}
