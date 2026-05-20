import { useState } from 'react'
import Menu from './Menu'
import type { MenuItem } from './Menu'

type Props = {
  categories: string[]
  active: string
  onChange: (cat: string) => void
  onAdd?: () => void
  onAddCategory?: (name: string) => Promise<void>
  onRemoveCategory?: (name: string) => Promise<void>
  onRenameCategory?: (changes: { from: string; to: string }[], newOrder: string[]) => Promise<void>
  onError?: (msg: string) => void
}

export default function CategoryFilter({ categories, active, onChange, onAdd, onAddCategory, onRemoveCategory, onRenameCategory, onError }: Props) {
  const [deleteMode, setDeleteMode] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showRenameModal, setShowRenameModal] = useState(false)
  const [editValues, setEditValues] = useState<Record<string, string>>({})
  const [editOrder, setEditOrder] = useState<string[]>([])
  const [newCat, setNewCat] = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [renameLoading, setRenameLoading] = useState(false)
  const [renameError, setRenameError] = useState<string | null>(null)

  const closeAddModal = () => { setShowAddModal(false); setAddError(null) }
  const closeRenameModal = () => { setShowRenameModal(false); setRenameError(null) }

  const moveTo = (from: number, to: number) => {
    setEditOrder(prev => {
      const a = [...prev]
      const [item] = a.splice(from, 1)
      a.splice(to, 0, item)
      return a
    })
  }

  const handleAdd = async () => {
    const name = newCat.trim()
    if (!name || categories.includes(name)) return
    setAddLoading(true)
    setAddError(null)
    try {
      await onAddCategory?.(name)
      setNewCat('')
      setShowAddModal(false)
    } catch {
      setAddError('Failed to add tag. Please try again.')
    } finally {
      setAddLoading(false)
    }
  }

  const handleRenameSave = async () => {
    const changes = editOrder
      .filter(key => editValues[key]?.trim() && editValues[key].trim() !== key)
      .map(key => ({ from: key, to: editValues[key].trim() }))
    const hasReorder = editOrder.some((key, i) => renamable[i] !== key)
    if (changes.length === 0 && !hasReorder) { closeRenameModal(); return }
    setRenameLoading(true)
    setRenameError(null)
    try {
      await onRenameCategory?.(changes, editOrder)
      closeRenameModal()
    } catch {
      setRenameError('Failed to save. Please try again.')
    } finally {
      setRenameLoading(false)
    }
  }

const pillBase = 'px-2 py-0.5 rounded text-xs transition-colors shrink-0'
  const activePill = `${pillBase} text-[--text] underline underline-offset-4`
  const inactivePill = `${pillBase} text-[--muted] hover:text-[--text] hover:bg-[--bg-subtle]`

  const renamable = categories.filter(c => c !== 'All')

  const catMenuItems: MenuItem[] = [
    ...(onAddCategory ? [{ label: 'New tag', onClick: () => { setNewCat(''); setAddError(null); setShowAddModal(true) } }] : []),
    ...(onRenameCategory && renamable.length > 0 ? [{ label: 'Edit tags', onClick: () => { setEditValues(Object.fromEntries(renamable.map(c => [c, c]))); setEditOrder([...renamable]); setRenameError(null); setShowRenameModal(true) } }] : []),
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
                  onClick={async () => {
                    try {
                      await onRemoveCategory?.(cat)
                    } catch {
                      onError?.('Failed to delete tag. Please try again.')
                    }
                  }}
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
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50"
          onClick={!addLoading ? closeAddModal : undefined}
        >
          <div
            className="rounded-lg border border-[--border] p-5 w-full max-w-xs flex flex-col gap-3"
            style={{ backgroundColor: 'var(--bg)' }}
            onClick={e => e.stopPropagation()}
          >
            <p className="text-base font-semibold">New tag</p>
            <input
              autoFocus
              value={newCat}
              onChange={e => setNewCat(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleAdd()
                if (e.key === 'Escape' && !addLoading) closeAddModal()
              }}
              placeholder="Tag name"
              maxLength={40}
              disabled={addLoading}
              className="px-2.5 py-1.5 border border-[--border] rounded text-sm bg-[--bg] text-[--text] focus:outline-none w-full disabled:opacity-60"
              style={{ fontSize: '16px' }}
            />
            {addError && <p className="text-[--danger] text-xs">{addError}</p>}
            <div className="flex gap-2 justify-end">
              <button
                onClick={closeAddModal}
                disabled={addLoading}
                className="px-3 py-1.5 border border-[--border] rounded text-sm hover:bg-[--bg-subtle] transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={addLoading || !newCat.trim() || categories.includes(newCat.trim())}
                className="px-3 py-1.5 bg-[--text] text-[--bg] rounded text-sm font-medium disabled:opacity-40"
              >
                {addLoading ? '…' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showRenameModal && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50"
          onClick={!renameLoading ? closeRenameModal : undefined}
        >
          <div
            className="rounded-lg border border-[--border] p-5 w-full max-w-xs flex flex-col gap-3"
            style={{ backgroundColor: 'var(--bg)' }}
            onClick={e => e.stopPropagation()}
          >
            <p className="text-sm font-semibold">Edit tags</p>
            <div className="flex flex-col gap-2">
              {editOrder.map((key, i) => (
                <div key={key} className="flex items-center gap-1.5">
                  {editOrder.length > 1 && (
                    <select
                      value={i}
                      onChange={e => moveTo(i, Number(e.target.value))}
                      disabled={renameLoading}
                      className="w-9 border border-[--border] rounded text-xs bg-[--bg] text-[--text] py-1 text-center disabled:opacity-40 cursor-pointer"
                    >
                      {editOrder.map((_, j) => (
                        <option key={j} value={j}>{j + 1}</option>
                      ))}
                    </select>
                  )}
                  <input
                    value={editValues[key] ?? key}
                    onChange={e => setEditValues(prev => ({ ...prev, [key]: e.target.value }))}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleRenameSave()
                      if (e.key === 'Escape' && !renameLoading) closeRenameModal()
                    }}
                    maxLength={40}
                    disabled={renameLoading}
                    className={`flex-1 px-2 py-1.5 border rounded text-xs bg-[--bg] text-[--text] focus:outline-none transition-colors disabled:opacity-60 ${editValues[key] && editValues[key] !== key ? 'border-[--text]' : 'border-[--border]'}`}
                    style={{ fontSize: '16px' }}
                  />
                </div>
              ))}
            </div>
            {renameError && <p className="text-[--danger] text-xs">{renameError}</p>}
            <div className="flex gap-2 justify-end">
              <button
                onClick={closeRenameModal}
                disabled={renameLoading}
                className="px-3 py-1 border border-[--border] rounded text-xs hover:bg-[--bg-subtle] transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={handleRenameSave}
                disabled={renameLoading}
                className="px-3 py-1 bg-[--text] text-[--bg] rounded text-xs font-medium disabled:opacity-40 flex items-center gap-1.5"
              >
                {renameLoading && <div className="w-3 h-3 border border-[--bg]/30 border-t-[--bg] rounded-full animate-spin" />}
                {renameLoading ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
