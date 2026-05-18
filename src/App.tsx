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
  fetchClosets, fetchConfig, getOwnProfile, createCloset, deleteCloset, updateCategories, updateClosetName,
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
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [processingBg, setProcessingBg] = useState<Set<string>>(new Set())
  const [closetName, setClosetName] = useState<string | undefined>(undefined)
  const [toast, setToast] = useState<string | null>(null)
  const [renamingCloset, setRenamingCloset] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [renameLoading, setRenameLoading] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleteClosetLoading, setDeleteClosetLoading] = useState(false)

  const token = user?.token?.access_token ?? ''
  const isOwner = !!user && userClosets.some(c => c.slug === slug)

  // load all closets publicly for nav display
  useEffect(() => {
    fetchClosets().then(setAllClosets).catch(() => {})
  }, [])

  // resolve own closets on mount if already logged in
  useEffect(() => {
    if (IS_DEV) {
      getOwnProfile(DEV_TOKEN).then(p => setUserClosets(p.closets)).catch(() => {})
      return
    }
    const currentUser = netlifyIdentity.currentUser()
    const t = currentUser?.token?.access_token ?? ''
    if (currentUser && t) getOwnProfile(t).then(p => setUserClosets(p.closets)).catch(() => {})
  }, [])

  useEffect(() => {
    if (IS_DEV) return
    const onLogin = (u: User) => {
      setUser(u)
      netlifyIdentity.close()
      const t = u.token?.access_token ?? ''
      if (t) getOwnProfile(t).then(p => setUserClosets(p.closets)).catch(() => {})
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems([])
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCategory(ALL)
    fetchItems(slug, controller.signal)
      .then(data => { setItems(data); setLoading(false) })
      .catch((err: Error) => { if (err.name !== 'AbortError') setLoading(false) })
    fetchConfig(slug)
      .then(c => { setCategories(c.categories); setClosetName(c.name) })
      .catch(() => setCategories(DEFAULT_CATEGORIES))
    return () => controller.abort()
  }, [slug])

  const allCategories = useMemo(() => [ALL, ...categories], [categories])
  const filtered = useMemo(
    () => category === ALL ? items : items.filter(i => i.category === category),
    [items, category]
  )

  if (!slug) return null

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }

  const startBgRemoval = (item: ClothingItem, file: File) => {
    setProcessingBg(prev => new Set(prev).add(item.id))
    removeBackground(file, slug, token)
      .then(processed => uploadImage(processed, slug, token))
      .then(imageUrl => updateItem({ ...item, imageUrl }, slug, token))
      .then(saved => setItems(prev => prev.map(i => i.id === saved.id ? saved : i)))
      .catch(() => showToast('Background removal failed.'))
      .finally(() => setProcessingBg(prev => { const s = new Set(prev); s.delete(item.id); return s }))
  }

  const handleSave = async (item: SavePayload, bgFile?: File) => {
    if (item.id) {
      const saved = await updateItem({ ...item, id: item.id }, slug, token)
      setItems(prev => prev.map(i => i.id === saved.id ? saved : i))
      if (bgFile) startBgRemoval(saved, bgFile)
    } else {
      const saved = await createItem(item, slug, token)
      setItems(prev => [...prev, saved])
      if (bgFile) startBgRemoval(saved, bgFile)
    }
    setModal(null)
  }

  const handleDelete = async (id: string) => {
    if (deletingId) return
    if (!confirm('Delete this item?')) return
    setDeletingId(id)
    setDeleteError(null)
    try {
      await deleteItem(id, slug, token)
      setItems(prev => prev.filter(i => i.id !== id))
    } catch {
      setDeleteError('Failed to delete item. Please try again.')
    } finally {
      setDeletingId(null)
    }
  }

  const handleAddCategory = async (name: string) => {
    if (!slug) return
    const updated = [...categories, name]
    const config = await updateCategories(updated, slug, token)
    setCategories(config.categories)
  }

  const handleRemoveCategory = async (name: string) => {
    if (!slug) return
    const updated = categories.filter(c => c !== name)
    const config = await updateCategories(updated, slug, token)
    setCategories(config.categories)
    if (category === name) setCategory(ALL)
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
    try {
      const config = await updateClosetName(renameValue.trim(), slug, token)
      setClosetName(config.name)
      setUserClosets(prev => prev.map(c => c.slug === slug ? { ...c, name: config.name } : c))
      setAllClosets(prev => prev.map(c => c.slug === slug ? { ...c, name: config.name } : c))
      setRenamingCloset(false)
    } finally {
      setRenameLoading(false)
    }
  }

  const handleDeleteCloset = async () => {
    if (!slug) return
    setDeleteClosetLoading(true)
    try {
      await deleteCloset(slug, token)
      const remaining = userClosets.filter(c => c.slug !== slug)
      setUserClosets(remaining)
      setAllClosets(prev => prev.filter(c => c.slug !== slug))
      navigate(remaining.length > 0 ? `/${remaining[0].slug}` : '/')
    } finally {
      setDeleteClosetLoading(false)
      setConfirmingDelete(false)
    }
  }

  const handleTransferItem = async (item: ClothingItem, targetSlug: string) => {
    const { id: _id, ...payload } = item
    await createItem(payload, targetSlug, token)
    await deleteItem(item.id, slug!, token)
    setItems(prev => prev.filter(i => i.id !== item.id))
  }

  const otherClosets = isOwner ? userClosets.filter(c => c.slug !== slug) : []

  return (
    <div className="min-h-screen">
      <Header slug={slug} closets={allClosets} user={user} onLogin={IS_DEV ? () => {} : () => netlifyIdentity.open()} onLogout={IS_DEV ? () => {} : () => netlifyIdentity.logout()} onCreateCloset={isOwner ? handleCreateCloset : undefined} />
      <main className="max-w-4xl mx-auto px-4 pb-12">
        <CategoryFilter
          categories={allCategories}
          active={category}
          onChange={setCategory}
          onAdd={isOwner ? () => setModal({ mode: 'add' }) : undefined}
          onAddCategory={isOwner ? handleAddCategory : undefined}
          onRemoveCategory={isOwner ? handleRemoveCategory : undefined}
          onRename={isOwner ? () => { setRenameValue(closetName ?? slug ?? ''); setRenamingCloset(true) } : undefined}
          onDelete={isOwner ? () => setConfirmingDelete(true) : undefined}
        />
        {renamingCloset && (
          <form onSubmit={handleRenameCloset} className="flex items-center gap-2 mb-4">
            <input
              autoFocus
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              maxLength={60}
              className="px-2.5 py-1.5 border border-[--border] rounded text-sm bg-[--bg] text-[--text] w-44 focus:outline-none"
              disabled={renameLoading}
            />
            <button type="submit" disabled={renameLoading || !renameValue.trim()} className="px-3 py-1.5 bg-[--text] text-[--bg] rounded text-sm font-medium disabled:opacity-40">
              {renameLoading ? '…' : 'Save'}
            </button>
            <button type="button" onClick={() => setRenamingCloset(false)} className="px-3 py-1.5 border border-[--border] rounded text-sm hover:bg-[--bg-subtle]">
              Cancel
            </button>
          </form>
        )}
        {confirmingDelete && (
          <div className="flex items-center gap-3 p-3 mb-4 border border-[--danger] rounded text-sm">
            <span className="text-[--text] flex-1">Delete <strong>{closetName ?? slug}</strong>? All items will be permanently removed.</span>
            <button onClick={handleDeleteCloset} disabled={deleteClosetLoading} className="px-3 py-1 bg-[--danger] text-white rounded text-sm font-medium disabled:opacity-40 shrink-0">
              {deleteClosetLoading ? '…' : 'Delete'}
            </button>
            <button onClick={() => setConfirmingDelete(false)} className="px-3 py-1 border border-[--border] rounded text-sm hover:bg-[--bg-subtle] shrink-0">
              Cancel
            </button>
          </div>
        )}
        {deleteError && <p className="text-[--danger] text-sm text-center mt-3">{deleteError}</p>}
        {loading ? (
          <p className="text-[--muted] text-sm text-center mt-16">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-[--muted] text-sm text-center mt-16">
            {items.length === 0 ? 'No items yet.' : 'No items in this category.'}
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
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
      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[300] px-4 py-2.5 bg-[--text] text-[--bg] text-sm rounded-lg shadow-lg whitespace-nowrap">
          {toast}
        </div>
      )}
    </div>
  )
}
