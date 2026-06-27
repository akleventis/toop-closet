import { useState, useEffect, useRef } from 'react'
import type { UserCloset, FitItem, Fit } from '../types'
import { getImages } from '../types'
import { fetchItems, fetchConfig, updateFit } from '../api'
import { IS_DEV } from '../hooks/useAuth'
import type { ClothingItem } from '../types'

type Props = {
  closets: UserCloset[]
  token: string
  editingFit?: Fit
  // Pool mode (suitcases): restrict the picker to these packed items instead of browsing closets.
  pool?: FitItem[]
  suitcaseId?: string
  // Pack mode (suitcases): browse closets and multi-select items to save as the suitcase's
  // packed set. `initialItems` pre-selects what's already packed; `onAddItems` persists the selection.
  packMode?: boolean
  initialItems?: FitItem[]
  onAddItems?: (items: FitItem[]) => Promise<void>
  // Kick off (re)generation - `stub` (dev only) swaps the AI call for a placeholder image.
  onGenerate?: (name: string | undefined, items: FitItem[], context: string, existingFit?: Fit, stub?: boolean, suitcaseId?: string) => void
  // Save name/item edits against the existing image (edit mode, no regenerate).
  onSaved?: (fit: Fit) => void
  onClose: () => void
}

export default function FitBuilder({ closets, token, editingFit, pool, suitcaseId, packMode, initialItems, onAddItems, onGenerate, onSaved, onClose }: Props) {
  const poolMode = !!pool
  const [activeSlug, setActiveSlug] = useState(closets[0]?.slug ?? '')
  const [itemCache, setItemCache] = useState<Record<string, ClothingItem[]>>({})
  const [categoryCache, setCategoryCache] = useState<Record<string, string[]>>({})
  const loadedSlugs = useRef(new Set<string>())
  const [loadingItems, setLoadingItems] = useState(false)
  const [selected, setSelected] = useState<FitItem[]>(editingFit?.items ?? initialItems ?? [])
  const [fitName, setFitName] = useState(editingFit?.name ?? '')
  const [context, setContext] = useState(editingFit?.context ?? '') // styling direction; persisted with the fit so it pre-fills on edit
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stub, setStub] = useState(false) // dev-only: use placeholder image instead of AI

  useEffect(() => {
    if (poolMode || !activeSlug || loadedSlugs.current.has(activeSlug)) return
    loadedSlugs.current.add(activeSlug)
    setLoadingItems(true)
    Promise.all([fetchItems(activeSlug), fetchConfig(activeSlug)])
      .then(([items, config]) => {
        setItemCache(prev => ({ ...prev, [activeSlug]: items }))
        setCategoryCache(prev => ({ ...prev, [activeSlug]: config.categories }))
      })
      .catch(() => {
        setItemCache(prev => ({ ...prev, [activeSlug]: [] }))
      })
      .finally(() => setLoadingItems(false))
  }, [activeSlug, poolMode])

  const activeCategories = categoryCache[activeSlug] ?? []
  const activeItems = [...(itemCache[activeSlug] ?? [])].sort(
    (a, b) => activeCategories.indexOf(a.category) - activeCategories.indexOf(b.category)
  )

  // Both modes render a grid of FitItem snapshots: pool mode shows the packed items directly,
  // closet mode projects the active closet's ClothingItems into the same shape.
  const gridItems: FitItem[] = poolMode
    ? pool!
    : activeItems.map(it => ({ itemId: it.id, slug: activeSlug, name: it.name, imageUrl: getImages(it)[0] ?? '' }))

  const isSelected = (fi: FitItem) => selected.some(s => s.itemId === fi.itemId && s.slug === fi.slug)

  const toggle = (fi: FitItem) => {
    setSelected(prev => {
      const already = prev.findIndex(s => s.itemId === fi.itemId && s.slug === fi.slug)
      if (already >= 0) return prev.filter((_, i) => i !== already)
      return [...prev, fi]
    })
  }

  // Hand the job to the parent and close — the loading card appears on /fits.
  const handleGenerate = () => {
    onGenerate?.(fitName.trim() || undefined, selected, context.trim(), editingFit, IS_DEV && stub, suitcaseId)
    onClose()
  }

  // Pack mode: persist the selected items as the suitcase's packed set.
  const handlePack = async () => {
    if (!onAddItems) return
    setSaving(true)
    setError(null)
    try {
      await onAddItems(selected)
      onClose()
    } catch {
      setError('Failed to save. Please try again.')
      setSaving(false)
    }
  }

  // Edit mode: persist name/item changes against the existing image — no regenerate.
  const handleSaveEdit = async () => {
    if (!editingFit) return
    setSaving(true)
    setError(null)
    try {
      const fit = await updateFit(editingFit.id, { name: fitName.trim(), items: selected, context: context.trim() }, token)
      onSaved?.(fit)
    } catch {
      setError('Failed to save. Please try again.')
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4"
      onClick={!saving ? onClose : undefined}
    >
      <div
        className="rounded-lg border border-[--border] w-full max-w-lg flex flex-col max-h-[90vh] overflow-hidden"
        style={{ backgroundColor: 'var(--bg)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[--border] flex-none">
          <h2 className="text-xs font-semibold text-[--text]">{packMode ? 'Pack items' : editingFit ? 'Edit fit' : 'Create fit'}</h2>
          <button
            onClick={onClose}
            disabled={saving}
            className="text-[--muted] hover:text-[--text] transition-colors text-base leading-none disabled:opacity-40"
          >
            ×
          </button>
        </div>

        {/* Scrollable content area */}
        <div className="flex flex-col flex-1 min-h-0">
          {!poolMode && closets.length > 1 && (
            <div className="flex gap-1 px-4 pt-3 pb-2 overflow-x-auto scrollbar-none flex-none">
              {closets.map(c => (
                <button
                  key={c.slug}
                  onClick={() => setActiveSlug(c.slug)}
                  className={`px-2.5 py-1 rounded text-xs shrink-0 transition-colors ${activeSlug === c.slug ? 'border border-[--text] text-[--text]' : 'text-[--muted] hover:text-[--text]'}`}
                >
                  {c.name ?? c.slug}
                </button>
              ))}
            </div>
          )}
          <div className="overflow-y-auto flex-1 min-h-0 p-3">
            {loadingItems ? (
              <p className="text-xs text-[--muted] text-center py-8">Loading…</p>
            ) : gridItems.length === 0 ? (
              <p className="text-xs text-[--muted] text-center py-8">{poolMode ? 'Nothing packed yet.' : 'No items in this closet.'}</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {gridItems.map(item => {
                  const img = item.imageUrl
                  const sel = isSelected(item)
                  return (
                    <button key={`${item.slug}-${item.itemId}`} onClick={() => toggle(item)} className="flex flex-col gap-0.5">
                      <div className={`relative aspect-square w-full rounded overflow-hidden border-2 transition-colors ${sel ? 'border-[--text]' : 'border-transparent'}`}>
                        <img src={img} alt={item.name} className="w-full h-full object-cover" />
                        {sel && (
                          <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                            <span className="bg-[--text] text-[--bg] rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">✓</span>
                          </div>
                        )}
                      </div>
                      {/* Name below the image so items can be referenced by name in the styling notes. */}
                      <span className="px-0.5 text-[10px] text-center truncate text-[--muted]">{item.name}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Selected tray */}
        {selected.length > 0 && (
          <div className="px-4 py-2 border-t border-[--border] flex gap-1.5 overflow-x-auto scrollbar-none flex-none">
            {selected.map(s => (
              <div key={`${s.slug}-${s.itemId}`} className="shrink-0 w-12">
                <div className="relative">
                  <img src={s.imageUrl} alt={s.name} className="w-12 h-12 rounded object-cover border border-[--border]" />
                  <button
                    onClick={() => setSelected(prev => prev.filter(p => !(p.itemId === s.itemId && p.slug === s.slug)))}
                    className="absolute -top-1 -right-1 bg-[--text] text-[--bg] rounded-full w-3.5 h-3.5 flex items-center justify-center text-[9px] leading-none"
                  >
                    ×
                  </button>
                </div>
                {/* Name caption — what you reference in the styling notes below. */}
                <span className="block text-[9px] text-[--muted] truncate text-center mt-0.5">{s.name}</span>
              </div>
            ))}
          </div>
        )}

        {error && <p className="text-[--danger] text-xs px-4 pb-2 flex-none">{error}</p>}

        {packMode ? (
          <div className="px-4 py-2.5 border-t border-[--border] flex justify-end gap-2 flex-none">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-3 py-1.5 border border-[--border] rounded text-xs hover:bg-[--bg-subtle] transition-colors disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              onClick={handlePack}
              disabled={saving}
              className="px-3 py-1.5 bg-[--text] text-[--bg] rounded text-xs font-medium disabled:opacity-40"
            >
              {saving ? 'Saving…' : `Save${selected.length > 0 ? ` (${selected.length})` : ''}`}
            </button>
          </div>
        ) : (
        <div className="px-4 py-2.5 border-t border-[--border] flex flex-col gap-2.5 flex-none">
          <input
            value={fitName}
            onChange={e => setFitName(e.target.value)}
            placeholder="title"
            maxLength={60}
            className="px-2.5 py-1 border border-[--border] rounded bg-[--bg] text-[--text] focus:outline-none w-full"
            style={{ fontSize: '16px' }}
            disabled={saving}
          />
          <textarea
            value={context}
            onChange={e => setContext(e.target.value)}
            placeholder="additional context"
            maxLength={300}
            rows={2}
            className="px-2.5 py-1.5 border border-[--border] rounded bg-[--bg] text-[--text] focus:outline-none w-full resize-none"
            style={{ fontSize: '16px' }}
            disabled={saving}
          />
          <div className="flex items-center justify-between gap-2">
            {IS_DEV ? (
              <button
                type="button"
                onClick={() => setStub(s => !s)}
                disabled={saving}
                title="Dev only — skip the AI call and use a placeholder image"
                className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-xs transition-colors disabled:opacity-40 ${stub ? 'text-[--text]' : 'text-[--muted] hover:text-[--text]'}`}
              >
                <span className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center text-[9px] leading-none ${stub ? 'bg-[--text] text-[--bg] border-[--text]' : 'border-[--border]'}`}>
                  {stub ? '✓' : ''}
                </span>
                Placeholder
              </button>
            ) : <span />}
            <div className="flex gap-2">
              <button
                onClick={onClose}
                disabled={saving}
                className="px-3 py-1.5 border border-[--border] rounded text-xs hover:bg-[--bg-subtle] transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
              {editingFit && (
                <button
                  onClick={handleSaveEdit}
                  disabled={selected.length === 0 || saving}
                  className="px-3 py-1.5 border border-[--border] rounded text-xs hover:bg-[--bg-subtle] transition-colors disabled:opacity-40"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              )}
              <button
                onClick={handleGenerate}
                disabled={selected.length === 0 || saving}
                className="px-3 py-1.5 bg-[--text] text-[--bg] rounded text-xs font-medium disabled:opacity-40"
              >
                {editingFit ? 'Regenerate' : `Generate${selected.length > 0 ? ` (${selected.length})` : ''}`}
              </button>
            </div>
          </div>
        </div>
        )}
      </div>
    </div>
  )
}
