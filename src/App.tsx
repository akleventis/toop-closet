import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
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
  fetchClosets, fetchConfig, getOwnConfig, updateCategories,
} from './api'
import type { ClothingItem, ModalState, SavePayload } from './types'

const ALL = 'All'

netlifyIdentity.init({ APIUrl: 'https://toop-closet.netlify.app/.netlify/identity' })

export default function App() {
  const { slug } = useParams<{ slug: string }>()
  const [user, setUser] = useState<User | null>(netlifyIdentity.currentUser())
  const [userSlug, setUserSlug] = useState<string | null>(null)
  const [closets, setClosets] = useState<string[]>([])
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES)
  const [items, setItems] = useState<ClothingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState(ALL)
  const [modal, setModal] = useState<ModalState | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [processingBg, setProcessingBg] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<string | null>(null)

  const token = user?.token?.access_token ?? ''
  const isOwner = !!user && userSlug === slug

  // fetch closet list once for nav
  useEffect(() => {
    fetchClosets().then(setClosets).catch(() => {})
  }, [])

  // resolve own slug on mount if already logged in
  useEffect(() => {
    const currentUser = netlifyIdentity.currentUser()
    const t = currentUser?.token?.access_token ?? ''
    if (currentUser && t) getOwnConfig(t).then(c => setUserSlug(c.slug)).catch(() => {})
  }, [])

  useEffect(() => {
    const onLogin = (u: User) => {
      setUser(u)
      netlifyIdentity.close()
      const t = u.token?.access_token ?? ''
      if (t) getOwnConfig(t).then(c => setUserSlug(c.slug)).catch(() => {})
    }
    const onLogout = () => { setUser(null); setUserSlug(null); setModal(null) }
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
    setLoading(true)
    setItems([])
    setCategory(ALL)
    fetchItems(slug, controller.signal)
      .then(data => { setItems(data); setLoading(false) })
      .catch((err: Error) => { if (err.name !== 'AbortError') setLoading(false) })
    fetchConfig(slug)
      .then(c => setCategories(c.categories))
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
    const updated = [...categories, name]
    const config = await updateCategories(updated, token)
    setCategories(config.categories)
  }

  const handleRemoveCategory = async (name: string) => {
    const updated = categories.filter(c => c !== name)
    const config = await updateCategories(updated, token)
    setCategories(config.categories)
    if (category === name) setCategory(ALL)
  }

  return (
    <div className="min-h-screen">
      <Header slug={slug} closets={closets} user={user} onLogin={() => netlifyIdentity.open()} onLogout={() => netlifyIdentity.logout()} />
      <main className="max-w-4xl mx-auto px-4 pb-12">
        <CategoryFilter
          categories={allCategories}
          active={category}
          onChange={setCategory}
          onAdd={isOwner ? () => setModal({ mode: 'add' }) : undefined}
          onAddCategory={isOwner ? handleAddCategory : undefined}
          onRemoveCategory={isOwner ? handleRemoveCategory : undefined}
        />
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
                onEdit={item => setModal({ mode: 'edit', item })}
                onDelete={handleDelete}
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
