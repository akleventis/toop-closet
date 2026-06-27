import { useState, useEffect, useMemo } from 'react'
import type { FormEvent } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Header from './components/Header'
import CategoryFilter from './components/CategoryFilter'
import ClothingCard from './components/ClothingCard'
import ItemModal from './components/ItemModal'
import Modal from './components/Modal'
import Toast from './components/Toast'
import { DEFAULT_CATEGORIES } from './constants'
import { useAuth } from './hooks/useAuth'
import { useToast } from './hooks/useToast'
import {
  fetchItems, createItem, updateItem, deleteItem,
  removeBackground, uploadImage,
  fetchConfig, createCloset, deleteCloset, updateCategories, updateClosetName, deleteImage,
} from './api'
import { getImages } from './types'
import type { ClothingItem, ModalState, SavePayload } from './types'

const ALL = 'All'

export default function App() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { user, token, isOwner, userClosets, setUserClosets, allClosets, setAllClosets, login, logout } = useAuth()
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES)
  const [items, setItems] = useState<ClothingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState(ALL)
  const [modal, setModal] = useState<ModalState | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [processingBg, setProcessingBg] = useState<Set<string>>(new Set())
  const [closetName, setClosetName] = useState<string | undefined>(undefined)
  const { toast, showToast } = useToast()
  const [searchQuery, setSearchQuery] = useState('')
  const [sharedItemId, setSharedItemId] = useState<string | null>(null)
  const [itemParam] = useState(() => new URLSearchParams(window.location.search).get('item'))
  const [renamingCloset, setRenamingCloset] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [renameLoading, setRenameLoading] = useState(false)
  const [renameClosetError, setRenameClosetError] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleteClosetLoading, setDeleteClosetLoading] = useState(false)
  const [deleteClosetError, setDeleteClosetError] = useState<string | null>(null)

  useEffect(() => {
    if (!slug) return
    const controller = new AbortController()
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset view state on slug change before refetch
    setLoading(true)
    setItems([])
    setCategory(ALL)
    setSearchQuery('')
    setClosetName(undefined)
    setDeleteError(null)
    setSharedItemId(null)
    fetchItems(slug, controller.signal)
      .then(data => {
        setItems(data)
        setLoading(false)
        if (itemParam) {
          const match = data.find(i => i.id.startsWith(itemParam))
          if (match) { setSharedItemId(match.id); setCategory(match.category) }
          window.history.replaceState({}, '', window.location.pathname)
        }
      })
      .catch((err: Error) => { if (err.name !== 'AbortError') setLoading(false) })
    fetchConfig(slug)
      .then(c => { setCategories(c.categories); setClosetName(c.name) })
      .catch(() => setCategories(DEFAULT_CATEGORIES))
    return () => controller.abort()
  }, [slug, itemParam])

  const allCategories = useMemo(() => [ALL, ...categories], [categories])
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    let base = category !== ALL
      ? items.filter(i => i.category === category)
      : [...items].sort((a, b) => categories.indexOf(a.category) - categories.indexOf(b.category))
    if (q) base = base.filter(i => i.name.toLowerCase().includes(q))
    return base
  }, [items, category, categories, searchQuery])

  if (!slug) return null

  const startBgRemoval = (item: ClothingItem, bgFiles: (File | null)[]) => {
    setProcessingBg(prev => new Set(prev).add(item.id))
    const imageUrls = [...getImages(item)]
      ; (async () => {
        const replacedUrls: string[] = []
        for (let i = 0; i < bgFiles.length; i++) {
          const file = bgFiles[i]
          if (!file || i >= imageUrls.length) continue
          const oldUrl = imageUrls[i]
          const processed = await removeBackground(file, slug, token)
          imageUrls[i] = await uploadImage(processed, slug, token)
          replacedUrls.push(oldUrl)
        }
        const saved = await updateItem({ ...item, imageUrl: imageUrls[0] ?? '', imageUrls }, slug, token)
        setItems(prev => prev.map(it => it.id === saved.id ? saved : it))
        for (const url of replacedUrls) deleteImage(url, slug, token).catch(() => { })
      })()
        .catch(() => showToast('Background removal failed.', 'error'))
        .finally(() => setProcessingBg(prev => { const s = new Set(prev); s.delete(item.id); return s }))
  }

  const handleSave = async (item: SavePayload, bgFiles?: (File | null)[]) => {
    if (item.id) {
      const saved = await updateItem({ ...item, id: item.id }, slug, token)
      setItems(prev => prev.map(i => i.id === saved.id ? saved : i))
      if (bgFiles?.some(f => f !== null)) startBgRemoval(saved, bgFiles)
    } else {
      const saved = await createItem(item, slug, token)
      setItems(prev => [...prev, saved])
      if (bgFiles?.some(f => f !== null)) startBgRemoval(saved, bgFiles)
    }
    setModal(null)
  }

  const handleDelete = (id: string) => {
    setDeleteError(null)
    setConfirmDeleteId(id)
  }

  const handleConfirmDelete = async () => {
    if (!confirmDeleteId || deletingId) return
    const id = confirmDeleteId
    setDeletingId(id)
    setDeleteError(null)
    try {
      await deleteItem(id, slug, token)
      setItems(prev => prev.filter(i => i.id !== id))
      setConfirmDeleteId(null)
    } catch {
      setDeleteError('Failed to delete. Please try again.')
    } finally {
      setDeletingId(null)
    }
  }

  const handleSaveTagEdits = async ({ finalList, renames }: { finalList: string[]; renames: { from: string; to: string }[] }) => {
    await updateCategories(finalList, slug, token)
    setCategories(finalList)
    for (const { from, to } of renames) {
      const affected = items.filter(i => i.category === from)
      for (const item of affected) {
        await updateItem({ ...item, category: to }, slug, token)
      }
      setItems(prev => prev.map(i => i.category === from ? { ...i, category: to } : i))
    }
    setCategory(prev => {
      const renamed = renames.find(r => r.from === prev)?.to
      if (renamed) return renamed
      if (finalList.includes(prev)) return prev
      return ALL
    })
  }

  const handleCreateCloset = async (name: string): Promise<string> => {
    const config = await createCloset(name, token)
    const entry = { slug: config.slug, name: config.name }
    setUserClosets(prev => [...prev, entry])
    setAllClosets(prev => [...prev, entry])
    return config.slug
  }

  const handleRenameCloset = async (e: FormEvent) => {
    e.preventDefault()
    if (!slug || !renameValue.trim()) return
    setRenameLoading(true)
    setRenameClosetError(null)
    try {
      const config = await updateClosetName(renameValue.trim(), slug, token)
      setClosetName(config.name)
      setUserClosets(prev => prev.map(c => c.slug === slug ? { ...c, name: config.name } : c))
      setAllClosets(prev => prev.map(c => c.slug === slug ? { ...c, name: config.name } : c))
      setRenamingCloset(false)
    } catch {
      setRenameClosetError('Failed to rename. Please try again.')
    } finally {
      setRenameLoading(false)
    }
  }

  const handleDeleteCloset = async () => {
    if (!slug) return
    setDeleteClosetLoading(true)
    setDeleteClosetError(null)
    try {
      await deleteCloset(slug, token)
      const remaining = userClosets.filter(c => c.slug !== slug)
      setUserClosets(remaining)
      setAllClosets(prev => prev.filter(c => c.slug !== slug))
      setConfirmingDelete(false)
      navigate(remaining.length > 0 ? `/${remaining[0].slug}` : '/')
    } catch {
      setDeleteClosetError('Failed to delete closet. Please try again.')
    } finally {
      setDeleteClosetLoading(false)
    }
  }

  const handleTransferItem = async (item: ClothingItem, targetSlug: string) => {
    const { id: _id, ...payload } = item
    try {
      await createItem(payload, targetSlug, token)
      await deleteItem(item.id, slug!, token)
      setItems(prev => prev.filter(i => i.id !== item.id))
    } catch {
      showToast('Transfer failed. Please try again.', 'error')
    }
  }

  const otherClosets = isOwner ? userClosets.filter(c => c.slug !== slug) : []

  return (
    <div className="min-h-screen">
      <Header
        slug={slug}
        closets={allClosets}
        user={user}
        onLogin={login}
        onLogout={logout}
        onCreateCloset={isOwner ? handleCreateCloset : undefined}
        onRenameCloset={isOwner ? () => { setRenameValue(closetName ?? slug ?? ''); setRenameClosetError(null); setRenamingCloset(true) } : undefined}
        onDeleteCloset={isOwner ? () => { setDeleteClosetError(null); setConfirmingDelete(true) } : undefined}
      />
      <main className="max-w-4xl mx-auto px-4 pb-12">
        <CategoryFilter
          categories={allCategories}
          active={category}
          onChange={setCategory}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onAdd={isOwner ? () => setModal({ mode: 'add', defaultCategory: category === ALL ? undefined : category }) : undefined}
          onSaveTagEdits={isOwner ? handleSaveTagEdits : undefined}
        />
        {loading ? (
          <p className="text-[--muted] text-sm text-center mt-16">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-[--muted] text-sm text-center mt-16">
            {items.length === 0 ? 'No items yet.' : searchQuery.trim() ? 'No items match your search.' : 'No items in this category.'}
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
            {filtered.map(item => (
              <ClothingCard
                key={item.id}
                item={item}
                isOwner={isOwner}
                isProcessing={processingBg.has(item.id)}
                otherClosets={otherClosets}
                autoOpen={item.id === sharedItemId}
                onEdit={item => setModal({ mode: 'edit', item })}
                onDelete={handleDelete}
                onTransfer={isOwner ? handleTransferItem : undefined}
                onShare={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/${slug}?item=${item.id.slice(0, 8)}`)
                  showToast('Link copied!')
                }}
              />
            ))}
          </div>
        )}
      </main>
      {modal && isOwner && (
        <ItemModal
          modal={modal}
          onSave={handleSave}
          onClose={() => setModal(null)}
          token={token}
          slug={slug}
          categories={categories}
        />
      )}
      {confirmDeleteId && (
        <Modal locked={!!deletingId} onClose={() => { setConfirmDeleteId(null); setDeleteError(null) }}>
          <h2 className="text-base font-semibold text-[--text]">Delete item?</h2>
          <p className="text-sm text-[--muted]">This item will be permanently removed.</p>
          {deleteError && <p className="text-[--danger] text-xs">{deleteError}</p>}
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setConfirmDeleteId(null); setDeleteError(null) }}
              disabled={!!deletingId}
              className="px-3.5 py-1.5 border border-[--border] rounded text-sm hover:bg-[--bg-subtle] transition-colors disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmDelete}
              disabled={!!deletingId}
              className="px-3.5 py-1.5 bg-[--danger] text-white rounded text-sm font-medium disabled:opacity-40"
            >
              {deletingId ? '…' : 'Delete'}
            </button>
          </div>
        </Modal>
      )}
      {renamingCloset && (
        <Modal locked={renameLoading} onClose={() => { setRenamingCloset(false); setRenameClosetError(null) }}>
          <form onSubmit={handleRenameCloset} className="flex flex-col gap-4">
            <h2 className="text-base font-semibold text-[--text]">Rename closet</h2>
            <input
              autoFocus
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              maxLength={60}
              className="px-3 py-2 border border-[--border] rounded text-sm bg-[--bg] text-[--text] focus:outline-none w-full"
              style={{ fontSize: '16px' }}
              disabled={renameLoading}
            />
            {renameClosetError && <p className="text-[--danger] text-xs">{renameClosetError}</p>}
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => { setRenamingCloset(false); setRenameClosetError(null) }}
                disabled={renameLoading}
                className="px-3.5 py-1.5 border border-[--border] rounded text-sm hover:bg-[--bg-subtle] transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={renameLoading || !renameValue.trim()}
                className="px-3.5 py-1.5 bg-[--text] text-[--bg] rounded text-sm font-medium disabled:opacity-40"
              >
                {renameLoading ? '…' : 'Save'}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {confirmingDelete && (
        <Modal locked={deleteClosetLoading} onClose={() => { setConfirmingDelete(false); setDeleteClosetError(null) }}>
          <h2 className="text-base font-semibold text-[--text]">Delete closet</h2>
          <p className="text-sm text-[--muted]">Delete <strong className="text-[--text]">{closetName ?? slug}</strong>? All items will be permanently removed.</p>
          {deleteClosetError && <p className="text-[--danger] text-xs">{deleteClosetError}</p>}
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setConfirmingDelete(false); setDeleteClosetError(null) }}
              disabled={deleteClosetLoading}
              className="px-3.5 py-1.5 border border-[--border] rounded text-sm hover:bg-[--bg-subtle] transition-colors disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteCloset}
              disabled={deleteClosetLoading}
              className="px-3.5 py-1.5 bg-[--danger] text-white rounded text-sm font-medium disabled:opacity-40"
            >
              {deleteClosetLoading ? '…' : 'Delete'}
            </button>
          </div>
        </Modal>
      )}
      {toast && <Toast message={toast.msg} variant={toast.variant} />}
    </div>
  )
}
