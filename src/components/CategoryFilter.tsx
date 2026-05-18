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
  onRenameCategory?: (oldName: string, newName: string) => void
}

export default function CategoryFilter({ categories, active, onChange, onAdd, onAddCategory, onRemoveCategory, onRenameCategory }: Props) {
  const [deleteMode, setDeleteMode] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showRenameModal, setShowRenameModal] = useState(false)
  const [renameTarget, setRenameTarget] = useState<string | null>(null)
  const [newCat, setNewCat] = useState('')
  const [editCat, setEditCat] = useState('')

  const handleAdd = () => {
    const name = newCat.trim()
    if (!name || categories.includes(name)) return
    onAddCategory?.(name)
    setNewCat('')
    setShowAddModal(false)
  }

  const handleRename = () => {
    if (!renameTarget) return
    const name = editCat.trim()
    if (!name || name === renameTarget || categories.includes(name)) return
    onRenameCategory?.(renameTarget, name)
    setShowRenameModal(false)
    setRenameTarget(null)
  }

  const pillBase = 'px-2.5 py-0.5 rounded text-sm transition-colors shrink-0'
  const activePill = `${pillBase} text-[--text] underline underline-offset-4`
  const inactivePill = `${pillBase} text-[--muted] hover:text-[--text] hover:bg-[--bg-subtle]`

  const renamable = categories.filter(c => c !== 'All')

  const catMenuItems: MenuItem[] = [
    ...(onAddCategory ? [{ label: 'New tag', onClick: () => { setNewCat(''); setShowAddModal(true) } }] : []),
    ...(onRenameCategory && renamable.length > 0 ? [{ label: 'Rename tag', onClick: () => { setRenameTarget(null); setShowRenameModal(true) } }] : []),
    ...(onRemoveCategory && renamable.length > 0 ? [{ label: 'Delete tags', onClick: () => setDeleteMode(true) }] : []),
  ]

  return (
    <div className="my-5">
      <div className="flex items-center gap-1">
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-0.5 flex-1">
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
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50" onClick={() => { setShowRenameModal(false); setRenameTarget(null) }}>
          <div className="rounded-lg border border-[--border] p-5 w-full max-w-xs flex flex-col gap-3" style={{ backgroundColor: 'var(--bg)' }} onClick={e => e.stopPropagation()}>
            {renameTarget === null ? (
              <>
                <p className="text-base font-semibold">Rename which tag?</p>
                <div className="flex flex-col">
                  {renamable.map(cat => (
                    <button
                      key={cat}
                      onClick={() => { setRenameTarget(cat); setEditCat(cat) }}
                      className="text-left px-2 py-1.5 rounded text-sm hover:bg-[--bg-subtle] transition-colors"
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                <div className="flex justify-end">
                  <button onClick={() => setShowRenameModal(false)} className="px-3 py-1.5 border border-[--border] rounded text-sm hover:bg-[--bg-subtle] transition-colors">Cancel</button>
                </div>
              </>
            ) : (
              <>
                <p className="text-base font-semibold">Rename "{renameTarget}"</p>
                <input
                  autoFocus
                  value={editCat}
                  onChange={e => setEditCat(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setRenameTarget(null) }}
                  maxLength={40}
                  className="px-2.5 py-1.5 border border-[--border] rounded text-sm bg-[--bg] text-[--text] focus:outline-none w-full"
                />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setRenameTarget(null)} className="px-3 py-1.5 border border-[--border] rounded text-sm hover:bg-[--bg-subtle] transition-colors">Back</button>
                  <button onClick={handleRename} disabled={!editCat.trim() || editCat.trim() === renameTarget || categories.includes(editCat.trim())} className="px-3 py-1.5 bg-[--text] text-[--bg] rounded text-sm font-medium disabled:opacity-40">Save</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
