type Props = {
  categories: string[]
  active: string
  onChange: (cat: string) => void
}

export default function CategoryFilter({ categories, active, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2 my-5">
      {categories.map(cat => (
        <button
          key={cat}
          aria-pressed={active === cat}
          onClick={() => onChange(cat)}
          className={`px-3.5 py-1 border rounded text-sm transition-colors ${
            active === cat
              ? 'bg-[--text] text-[--bg] border-[--text]'
              : 'border-[--border] text-[--muted] hover:border-[--text] hover:text-[--text]'
          }`}
        >
          {cat}
        </button>
      ))}
    </div>
  )
}
