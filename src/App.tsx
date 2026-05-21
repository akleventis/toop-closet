import { useState, useEffect, useMemo } from 'react'
import type { FormEvent } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import netlifyIdentity from 'netlify-identity-widget'
import type { User } from 'netlify-identity-widget'
import Header from './components/Header'
import CategoryFilter from './components/CategoryFilter'
import ClothingCard from './components/ClothingCard'
import ItemModal from './components/ItemModal'
import { DEFAULT_CATEGORIES } from './constants'
import {
  fetchItems, createItem, updateItem, deleteItem,
  removeBackground, uploadImage,
  fetchClosets, fetchConfig, getOwnProfile, createCloset, deleteCloset, updateCategories, updateClosetName, deleteImage,
} from './api'
import type { ClothingItem, ModalState, SavePayload, UserCloset } from './types'

const ALL = 'All'
const IS_DEV = import.meta.env.DEV
const DEV_TOKEN = 'dev-bypass'
const DEV_USER = { token: { access_token: DEV_TOKEN } } as unknown as User

if (!IS_DEV) {
  netlifyIdentity.init({ APIUrl: 'https://closet.tooper.io/.netlify/identity' })
}

export default function App() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(IS_DEV ? DEV_USER : netlifyIdentity.currentUser())
  const [allClosets, setAllClosets] = useState<UserCloset[]>([])
  const [userClosets, setUserClosets] = useState<UserCloset[]>([])
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
  const [toast, setToast] = useState<string | null>(null)
  const [renamingCloset, setRenamingCloset] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [renameLoading, setRenameLoading] = useState(false)
  const [renameClosetError, setRenameClosetError] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleteClosetLoading, setDeleteClosetLoading] = useState(false)
  const [deleteClosetError, setDeleteClosetError] = useState<string | null>(null)

  const token = user?.token?.access_token ?? ''
  const isOwner = !!user

  // load all closets publicly for nav display
  useEffect(() => {
    fetchClosets().then(setAllClosets).catch(() => { })
  }, [])

  // resolve own closets on mount if already logged in
  useEffect(() => {
    if (IS_DEV) {
      getOwnProfile(DEV_TOKEN).then(p => setUserClosets(p.closets)).catch(console.error)
      return
    }
    const currentUser = netlifyIdentity.currentUser()
    const t = currentUser?.token?.access_token ?? ''
    if (currentUser && t) getOwnProfile(t).then(p => setUserClosets(p.closets)).catch(console.error)
  }, [])

  useEffect(() => {
    if (IS_DEV) return
    const onLogin = (u: User) => {
      setUser(u)
      netlifyIdentity.close()
      const t = u.token?.access_token ?? ''
      if (t) getOwnProfile(t).then(p => setUserClosets(p.closets)).catch(console.error)
    }
    const onLogout = () => { setUser(null); setUserClosets([]); setModal(null) }
    netlifyIdentity.on('login', onLogin)
    netlifyIdentity.on('logout', onLogout)
    return () => {
      netlifyIdentity.off('login', onLogin)
      netlifyIdentity.off('logout', onLogout)
    }
  }, [])

  useEffect(() => {
    if (!slug) return
    const controller = new AbortController()
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setItems([])
    setCategory(ALL)
    setClosetName(undefined)
    setDeleteError(null)
    fetchItems(slug, controller.signal)
      .then(data => { setItems(data); setLoading(false) })
      .catch((err: Error) => { if (err.name !== 'AbortError') setLoading(false) })
    fetchConfig(slug)
      .then(c => { setCategories(c.categories); setClosetName(c.name) })
      .catch(() => setCategories(DEFAULT_CATEGORIES))
    return () => controller.abort()
  }, [slug])

  const allCategories = useMemo(() => [ALL, ...categories], [categories])
  const filtered = useMemo(() => {
    if (category !== ALL) return items.filter(i => i.category === category)
    return [...items].sort((a, b) => categories.indexOf(a.category) - categories.indexOf(b.category))
  }, [items, category, categories])

  if (!slug) return null

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }

  const startBgRemoval = (item: ClothingItem, bgFiles: (File | null)[]) => {
    setProcessingBg(prev => new Set(prev).add(item.id))
    const imageUrls = [...(item.imageUrls?.length ? item.imageUrls : item.imageUrl ? [item.imageUrl] : [])]
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
        .catch(() => showToast('Background removal failed.'))
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
    if (!slug) return
    const nameMap = new Map(renames.map(c => [c.from, c.to]))
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
      const renamed = nameMap.get(prev)
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
      showToast('Transfer failed. Please try again.')
    }
  }

  const otherClosets = isOwner ? userClosets.filter(c => c.slug !== slug) : []

  return (
    <div className="min-h-screen">
      <Header
        slug={slug}
        closets={allClosets}
        user={user}
        onLogin={IS_DEV ? () => { } : () => netlifyIdentity.open()}
        onLogout={IS_DEV ? () => { } : () => netlifyIdentity.logout()}
        onCreateCloset={isOwner ? handleCreateCloset : undefined}
        onRenameCloset={isOwner ? () => { setRenameValue(closetName ?? slug ?? ''); setRenameClosetError(null); setRenamingCloset(true) } : undefined}
        onDeleteCloset={isOwner ? () => { setDeleteClosetError(null); setConfirmingDelete(true) } : undefined}
      />
      <main className="max-w-4xl mx-auto px-4 pb-12">
        <CategoryFilter
          categories={allCategories}
          active={category}
          onChange={setCategory}
          onAdd={isOwner ? () => setModal({ mode: 'add', defaultCategory: category === ALL ? undefined : category }) : undefined}
          onSaveTagEdits={isOwner ? handleSaveTagEdits : undefined}
          onError={showToast}
        />
        {loading ? (
          <p className="text-[--muted] text-sm text-center mt-16">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-[--muted] text-sm text-center mt-16">
            {items.length === 0 ? 'No items yet.' : 'No items in this category.'}
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
                onEdit={item => setModal({ mode: 'edit', item })}
                onDelete={handleDelete}
                onTransfer={isOwner ? handleTransferItem : undefined}
              />
            ))}
          </div>
        )}
      </main>
      {modal && (
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
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4"
          onClick={!deletingId ? () => { setConfirmDeleteId(null); setDeleteError(null) } : undefined}
        >
          <div
            className="rounded-lg border border-[--border] p-6 w-full max-w-sm flex flex-col gap-4"
            style={{ backgroundColor: 'var(--bg)' }}
            onClick={e => e.stopPropagation()}
          >
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
          </div>
        </div>
      )}
      {renamingCloset && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4"
          onClick={!renameLoading ? () => { setRenamingCloset(false); setRenameClosetError(null) } : undefined}
        >
          <form
            onSubmit={handleRenameCloset}
            className="rounded-lg border border-[--border] p-6 w-full max-w-sm flex flex-col gap-4"
            style={{ backgroundColor: 'var(--bg)' }}
            onClick={e => e.stopPropagation()}
          >
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
        </div>
      )}
      {confirmingDelete && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4"
          onClick={!deleteClosetLoading ? () => { setConfirmingDelete(false); setDeleteClosetError(null) } : undefined}
        >
          <div
            className="rounded-lg border border-[--border] p-6 w-full max-w-sm flex flex-col gap-4"
            style={{ backgroundColor: 'var(--bg)' }}
            onClick={e => e.stopPropagation()}
          >
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
          </div>
        </div>
      )}
      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[300] px-4 py-2.5 bg-[--text] text-[--bg] text-sm rounded-lg shadow-lg whitespace-nowrap">
          {toast}
        </div>
      )}
    </div>
  )
}
