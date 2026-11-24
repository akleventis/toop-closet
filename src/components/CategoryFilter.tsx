import { useRef, useState } from 'react'
import Menu from './Menu'
import SearchInput from './SearchInput'
import AddButton from './AddButton'

type EditTag = { key: string; value: string; isNew: boolean }

type Props = {
  categories: string[]
  active: string
  onChange: (cat: string) => void
  searchQuery: string
  onSearchChange: (q: string) => void
  onAdd?: () => void
  onSaveTagEdits?: (opts: { finalList: string[]; renames: { from: string; to: string }[] }) => Promise<void>
}

export default function CategoryFilter({ categories, active, onChange, searchQuery, onSearchChange, onAdd, onSaveTagEdits }: Props) {
  const [showEditModal, setShowEditModal] = useState(false)
  const [editTags, setEditTags] = useState<EditTag[]>([])
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const newTagCounter = useRef(0)

  const renamable = categories.filter(c => c !== 'All')

  const openEditModal = () => {
    setEditTags(renamable.map(c => ({ key: c, value: c, isNew: false })))
    setEditError(null)
    setShowEditModal(true)
  }

  const closeEditModal = () => {
    setShowEditModal(false)
    setEditError(null)
  }

  const moveTag = (from: number, to: number) => {
    if (to < 0 || to >= editTags.length) return
    setEditTags(prev => {
      const a = [...prev]
      const [item] = a.splice(from, 1)
      a.splice(to, 0, item)
      return a
    })
  }

  const deleteTag = (index: number) => {
    setEditTags(prev => prev.filter((_, i) => i !== index))
  }

  const addTag = () => {
    const key = `__new_${newTagCounter.current++}`
    setEditTags(prev => [...prev, { key, value: '', isNew: true }])
  }

  const updateTagValue = (index: number, value: string) => {
    setEditTags(prev => prev.map((t, i) => i === index ? { ...t, value } : t))
  }

  const handleSave = async () => {
    const seen = new Set<string>()
    const finalList = editTags
      .map(t => t.value.trim())
      .filter(name => {
        if (!name || seen.has(name)) return false
        seen.add(name)
        return true
      })

    const isUnchanged =
      finalList.length === renamable.length &&
      finalList.every((name, i) => name === renamable[i])

    if (isUnchanged) { closeEditModal(); return }

    const renames = editTags
      .filter(t => !t.isNew && t.value.trim() && t.value.trim() !== t.key && finalList.includes(t.value.trim()))
      .map(t => ({ from: t.key, to: t.value.trim() }))

    setEditLoading(true)
    setEditError(null)
    try {
      await onSaveTagEdits?.({ finalList, renames })
      closeEditModal()
    } catch {
      setEditError('Failed to save. Please try again.')
    } finally {
      setEditLoading(false)
    }
  }

  const pillBase = 'px-2 py-0.5 text-xs transition-colors shrink-0'
  const activePill = `${pillBase} text-(--text)`
  const inactivePill = `${pillBase} text-(--muted) hover:text-(--text)`

  return (
    <div className="mb-3">
      <div className="flex items-center gap-1 min-h-8">
        {/* h-8 fits the 32px clear button, so the scroller never scrolls vertically */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none h-8 flex-1">
          <SearchInput value={searchQuery} onChange={onSearchChange} />
          {categories.map(cat => (
            <button
              key={cat}
              aria-pressed={active === cat}
              onClick={() => onChange(cat)}
              className={active === cat ? activePill : inactivePill}
            >
              {cat}
            </button>
          ))}
        </div>

        {onSaveTagEdits && <Menu items={[{ label: 'Edit tags', onClick: openEditModal }]} />}

        {onAdd && (
          <AddButton label="Add item" onClick={onAdd} />
        )}
      </div>

      {showEditModal && (
        <div
          className="scrim z-[200]"
          onClick={!editLoading ? closeEditModal : undefined}
        >
          <div
            className="sheet p-5 max-w-xs flex flex-col gap-3"
            onClick={e => e.stopPropagation()}
          >
            <p className="text-sm font-semibold">Edit tags</p>
            <div className="flex flex-col gap-2">
              {editTags.map((tag, i) => (
                <div key={tag.key} className="flex items-center gap-1.5">
                  <div className="flex flex-col">
                    <button
                      onClick={() => moveTag(i, i - 1)}
                      disabled={i === 0 || editLoading}
                      className="text-(--muted) hover:text-(--text) disabled:opacity-20 leading-none flex items-center justify-center w-5 h-4 text-xs transition-colors"
                      aria-label="Move up"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => moveTag(i, i + 1)}
                      disabled={i === editTags.length - 1 || editLoading}
                      className="text-(--muted) hover:text-(--text) disabled:opacity-20 leading-none flex items-center justify-center w-5 h-4 text-xs transition-colors"
                      aria-label="Move down"
                    >
                      ↓
                    </button>
                  </div>
                  <input
                    autoFocus={tag.isNew && i === editTags.length - 1}
                    value={tag.value}
                    onChange={e => updateTagValue(i, e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleSave()
                      if (e.key === 'Escape' && !editLoading) closeEditModal()
                    }}
                    maxLength={40}
                    disabled={editLoading}
                    placeholder="Tag name"
                    className="field flex-1 transition-colors"
                    style={{ borderColor: !tag.isNew && tag.value.trim() && tag.value.trim() !== tag.key ? 'var(--text)' : undefined }}
                  />
                  <button
                    onClick={() => deleteTag(i)}
                    disabled={editLoading}
                    className="text-(--muted) hover:text-(--danger) disabled:opacity-40 leading-none w-5 h-7 flex items-center justify-center transition-colors shrink-0 text-base"
                    aria-label={`Delete ${tag.value || 'tag'}`}
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                onClick={addTag}
                disabled={editLoading}
                className="text-xs text-(--muted) hover:text-(--text) transition-colors text-left py-1 disabled:opacity-40"
              >
                + Add tag
              </button>
            </div>
            {editError && <p className="text-(--danger) text-xs">{editError}</p>}
            <div className="flex gap-2 justify-end">
              <button
                onClick={closeEditModal}
                disabled={editLoading}
                className="btn"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={editLoading}
                className="btn-primary flex items-center gap-1.5"
              >
                {editLoading && <div className="w-3 h-3 border border-(--bg)/30 border-t-(--bg) rounded-full animate-spin" />}
                {editLoading ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
