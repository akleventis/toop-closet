import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import netlifyIdentity from 'netlify-identity-widget'
import type { User } from 'netlify-identity-widget'
import Header from './components/Header'
import CategoryFilter from './components/CategoryFilter'
import ClothingCard from './components/ClothingCard'
import ItemModal from './components/ItemModal'
import { CATEGORIES } from './constants'
import { fetchItems, createItem, updateItem, deleteItem, getMySlug } from './api'
import type { ClothingItem, ModalState, SavePayload } from './types'

const ALL_CATEGORIES = ['All', ...CATEGORIES]

netlifyIdentity.init()

export default function App() {
  const { slug } = useParams<{ slug: string }>()
  const [user, setUser] = useState<User | null>(netlifyIdentity.currentUser())
  const [userSlug, setUserSlug] = useState<string | null>(null)
  const [items, setItems] = useState<ClothingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const [category, setCategory] = useState('All')
  const [modal, setModal] = useState<ModalState | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const token = user?.token?.access_token ?? ''
  const isOwner = !!user && userSlug === slug

  useEffect(() => {
    if (user && token) {
      getMySlug(token).then(setUserSlug).catch(() => setUserSlug(null))
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onLogin = (u: User) => {
      setUser(u)
      netlifyIdentity.close()
      const t = u.token?.access_token ?? ''
      if (t) getMySlug(t).then(setUserSlug).catch(() => setUserSlug(null))
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
    const controller = new AbortController()
    setLoading(true)
    setItems([])
    setFetchError(false)
    fetchItems(slug, controller.signal)
      .then(data => { setItems(data); setLoading(false) })
      .catch((err: Error) => {
        if (err.name !== 'AbortError') { setFetchError(true); setLoading(false) }
      })
    return () => controller.abort()
  }, [slug])

  const filtered = useMemo(
    () => category === 'All' ? items : items.filter(i => i.category === category),
    [items, category]
  )

  const handleSave = async (item: SavePayload) => {
    if (item.id) {
      const saved = await updateItem({ ...item, id: item.id }, slug, token)
      setItems(prev => prev.map(i => i.id === saved.id ? saved : i))
    } else {
      const saved = await createItem(item, slug, token)
      setItems(prev => [...prev, saved])
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

  return (
    <div className="min-h-screen">
      <Header slug={slug} user={user} onLogin={() => netlifyIdentity.open()} onLogout={() => netlifyIdentity.logout()} />
      <main className="max-w-4xl mx-auto px-4 pb-12">
        <CategoryFilter categories={ALL_CATEGORIES} active={category} onChange={setCategory} />
        {isOwner && (
          <button
            className="mb-4 px-3.5 py-1.5 border border-[--border] rounded bg-[--text] text-[--bg] text-sm font-medium hover:opacity-80 transition-opacity"
            onClick={() => setModal({ mode: 'add' })}
          >
            + Add item
          </button>
        )}
        {deleteError && <p className="text-[--danger] text-sm text-center mt-3">{deleteError}</p>}
        {fetchError ? (
          <p className="text-[--muted] text-sm text-center mt-16">Failed to load inventory. Please refresh.</p>
        ) : loading ? (
          <p className="text-[--muted] text-sm text-center mt-16">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-[--muted] text-sm text-center mt-16">
            {items.length === 0 ? 'No items yet.' : 'No items in this category.'}
          </p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
            {filtered.map(item => (
              <ClothingCard
                key={item.id}
                item={item}
                isAdmin={isOwner}
                onEdit={item => setModal({ mode: 'edit', item })}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </main>
      {modal && (
        <ItemModal modal={modal} onSave={handleSave} onClose={() => setModal(null)} token={token} slug={slug} />
      )}
    </div>
  )
}
