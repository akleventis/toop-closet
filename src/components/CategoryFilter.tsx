import { useState, useRef } from 'react'
import Menu from './Menu'
import type { MenuItem } from './Menu'

type Props = {
  categories: string[]
  active: string
  onChange: (cat: string) => void
  onAdd?: () => void
  onAddCategory?: (name: string) => void
  onRemoveCategory?: (name: string) => void
  onRename?: () => void
  onDelete?: () => void
}

export default function CategoryFilter({ categories, active, onChange, onAdd, onAddCategory, onRemoveCategory, onRename, onDelete }: Props) {
  const [editing, setEditing] = useState(false)
  const [newCat, setNewCat] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleAddCategory = () => {
    const name = newCat.trim()
    if (!name || categories.includes(name)) return
    onAddCategory?.(name)
    setNewCat('')
    inputRef.current?.focus()
  }

  const pillBase = 'px-3.5 py-1 border rounded text-sm transition-colors'
  const activePill = `${pillBase} bg-[--text] text-[--bg] border-[--text]`
  const inactivePill = `${pillBase} border-[--border] text-[--muted] hover:border-[--text] hover:text-[--text]`

  return (
    <div className="my-5 flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {categories.map(cat => {
          const isAll = cat === 'All'
          return editing && !isAll ? (
            <span key={cat} className={`${inactivePill} flex items-center gap-1.5`}>
              {cat}
              <button
                onClick={() => onRemoveCategory?.(cat)}
                className="text-[--muted] hover:text-[--danger] leading-none"
                aria-label={`Remove ${cat}`}
              >
                ×
              </button>
            </span>
          ) : (
            <button
              key={cat}
              aria-pressed={active === cat}
              onClick={() => { if (!editing) onChange(cat) }}
              className={active === cat ? activePill : inactivePill}
            >
              {cat}
            </button>
          )
        })}

        {(onAdd || onAddCategory || onRename || onDelete) && (
          <Menu items={[
            onAdd && { label: 'Add item', onClick: onAdd },
            onAddCategory && { label: editing ? 'Done editing' : 'Edit categories', onClick: () => setEditing(e => !e) },
            onRename && { label: 'Rename closet', onClick: onRename },
            onDelete && { label: 'Delete closet', danger: true, onClick: onDelete },
          ].filter(Boolean) as MenuItem[]} />
        )}
      </div>

      {editing && onAddCategory && (
        <div className="flex gap-2 items-center">
          <input
            ref={inputRef}
            type="text"
            value={newCat}
            onChange={e => setNewCat(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddCategory()}
            placeholder="New category"
            maxLength={40}
            className="px-2.5 py-1.5 border border-[--border] rounded text-sm bg-[--bg] text-[--text] focus:outline-none focus:ring-1 focus:ring-[--text] w-44"
          />
          <button
            onClick={handleAddCategory}
            disabled={!newCat.trim() || categories.includes(newCat.trim())}
            className="px-3 py-1.5 border border-[--border] rounded text-sm font-medium hover:bg-[--bg-subtle] transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
          >
            Add
          </button>
        </div>
      )}
    </div>
  )
}
