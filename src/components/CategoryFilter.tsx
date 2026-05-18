import { useState } from 'react'
import Menu from './Menu'
import type { MenuItem } from './Menu'

type Props = {
  categories: string[]
  active: string
  onChange: (cat: string) => void
  onAdd?: () => void
  onAddCategory?: (name: string) => void
  onRemoveCategory?: (name: string) => void
  onRenameCategory?: (changes: { from: string; to: string }[]) => void
}

export default function CategoryFilter({ categories, active, onChange, onAdd, onAddCategory, onRemoveCategory, onRenameCategory }: Props) {
  const [deleteMode, setDeleteMode] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showRenameModal, setShowRenameModal] = useState(false)
  const [editValues, setEditValues] = useState<Record<string, string>>({})
  const [newCat, setNewCat] = useState('')

  const handleAdd = () => {
    const name = newCat.trim()
    if (!name || categories.includes(name)) return
    onAddCategory?.(name)
    setNewCat('')
    setShowAddModal(false)
  }

  const handleRenameSave = () => {
    const changes = renamable
      .filter(c => editValues[c]?.trim() && editValues[c].trim() !== c)
      .map(c => ({ from: c, to: editValues[c].trim() }))
    onRenameCategory?.(changes)
    setShowRenameModal(false)
  }

const pillBase = 'px-2 py-0.5 rounded text-xs transition-colors shrink-0'
  const activePill = `${pillBase} text-[--text] underline underline-offset-4`
  const inactivePill = `${pillBase} text-[--muted] hover:text-[--text] hover:bg-[--bg-subtle]`

  const renamable = categories.filter(c => c !== 'All')

  const catMenuItems: MenuItem[] = [
    ...(onAddCategory ? [{ label: 'New tag', onClick: () => { setNewCat(''); setShowAddModal(true) } }] : []),
    ...(onRenameCategory && renamable.length > 0 ? [{ label: 'Rename tag', onClick: () => { setEditValues(Object.fromEntries(renamable.map(c => [c, c]))); setShowRenameModal(true) } }] : []),
    ...(onRemoveCategory && renamable.length > 0 ? [{ label: 'Delete tags', onClick: () => setDeleteMode(true) }] : []),
  ]

  return (
    <div className="my-5">
      <div className="flex items-center gap-1">
        <div className="flex gap-1 overflow-x-auto scrollbar-none pb-0.5 flex-1">
          {categories.map(cat => (
            <span key={cat} className="flex items-center shrink-0 gap-0.5">
              <button
                aria-pressed={active === cat}
                onClick={() => { if (!deleteMode) onChange(cat) }}
                className={active === cat ? activePill : inactivePill}
              >
                {cat}
              </button>
              {deleteMode && cat !== 'All' && (
                <button
                  onClick={() => onRemoveCategory?.(cat)}
                  className="text-[--muted] hover:text-[--danger] text-sm leading-none px-0.5"
                  aria-label={`Delete ${cat}`}
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>

        {catMenuItems.length > 0 && !deleteMode && <Menu items={catMenuItems} />}
        {deleteMode && (
          <button
            onClick={() => setDeleteMode(false)}
            className="text-xs text-[--muted] hover:text-[--text] px-2 py-0.5 transition-colors shrink-0"
          >
            Done
          </button>
        )}

        {onAdd && !deleteMode && (
          <button
            onClick={onAdd}
            title="Add item"
            className="text-[--muted] hover:text-[--text] transition-colors leading-none w-7 h-7 flex items-center justify-center text-base shrink-0"
          >
            +
          </button>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50" onClick={() => setShowAddModal(false)}>
          <div className="rounded-lg border border-[--border] p-5 w-full max-w-xs flex flex-col gap-3" style={{ backgroundColor: 'var(--bg)' }} onClick={e => e.stopPropagation()}>
            <p className="text-base font-semibold">New tag</p>
            <input
              autoFocus
              value={newCat}
              onChange={e => setNewCat(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setShowAddModal(false) }}
              placeholder="Category name"
              maxLength={40}
              className="px-2.5 py-1.5 border border-[--border] rounded text-sm bg-[--bg] text-[--text] focus:outline-none w-full"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowAddModal(false)} className="px-3 py-1.5 border border-[--border] rounded text-sm hover:bg-[--bg-subtle] transition-colors">Cancel</button>
              <button onClick={handleAdd} disabled={!newCat.trim() || categories.includes(newCat.trim())} className="px-3 py-1.5 bg-[--text] text-[--bg] rounded text-sm font-medium disabled:opacity-40">Add</button>
            </div>
          </div>
        </div>
      )}

      {showRenameModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50" onClick={() => setShowRenameModal(false)}>
          <div className="rounded-lg border border-[--border] p-5 w-full max-w-xs flex flex-col gap-3" style={{ backgroundColor: 'var(--bg)' }} onClick={e => e.stopPropagation()}>
            <p className="text-sm font-semibold">Rename tags</p>
            <div className="flex flex-col gap-2">
              {renamable.map(cat => (
                <input
                  key={cat}
                  value={editValues[cat] ?? cat}
                  onChange={e => setEditValues(prev => ({ ...prev, [cat]: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') handleRenameSave(); if (e.key === 'Escape') setShowRenameModal(false) }}
                  maxLength={40}
                  className={`px-2 py-1.5 border rounded text-xs bg-[--bg] text-[--text] focus:outline-none w-full transition-colors ${editValues[cat] && editValues[cat] !== cat ? 'border-[--text]' : 'border-[--border]'}`}
                />
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowRenameModal(false)} className="px-3 py-1 border border-[--border] rounded text-xs hover:bg-[--bg-subtle] transition-colors">Cancel</button>
              <button onClick={handleRenameSave} className="px-3 py-1 bg-[--text] text-[--bg] rounded text-xs font-medium">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
