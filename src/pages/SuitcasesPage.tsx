import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Suitcase } from '../types'
import { fetchSuitcases, createSuitcase, updateSuitcase, deleteSuitcase } from '../api'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import Header from '../components/Header'
import Menu from '../components/Menu'
import Modal from '../components/Modal'
import SearchInput from '../components/SearchInput'
import AddButton from '../components/AddButton'
import Toast from '../components/Toast'

export default function SuitcasesPage() {
  const { user, token, isOwner, backTo, activeWorkspace, login, logout } = useAuth()
  const navigate = useNavigate()
  const [suitcases, setSuitcases] = useState<Suitcase[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [createLoading, setCreateLoading] = useState(false)
  const [renaming, setRenaming] = useState<Suitcase | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [renameLoading, setRenameLoading] = useState(false)
  const { toast, showToast } = useToast()

  useEffect(() => {
    fetchSuitcases(activeWorkspace ?? undefined)
      .then(setSuitcases)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [activeWorkspace])

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    setCreateLoading(true)
    try {
      const created = await createSuitcase(newName.trim() || undefined, [], token, activeWorkspace ?? undefined)
      navigate(`/suitcases/${created.id}`)
    } catch {
      showToast('Failed to create suitcase.', 'error')
      setCreateLoading(false)
    }
  }

  const handleRename = async (e: FormEvent) => {
    e.preventDefault()
    if (!renaming) return
    setRenameLoading(true)
    try {
      const updated = await updateSuitcase(renaming.id, { name: renameValue.trim() }, token)
      setSuitcases(prev => prev.map(s => s.id === updated.id ? updated : s))
      setRenaming(null)
    } catch {
      showToast('Failed to rename.', 'error')
    } finally {
      setRenameLoading(false)
    }
  }

  const handleDelete = async (suitcase: Suitcase) => {
    try {
      await deleteSuitcase(suitcase.id, token)
      setSuitcases(prev => prev.filter(s => s.id !== suitcase.id))
    } catch {
      showToast('Failed to delete suitcase.', 'error')
    }
  }

  const query = searchQuery.trim().toLowerCase()
  const shownSuitcases = query ? suitcases.filter(s => s.name?.toLowerCase().includes(query)) : suitcases

  return (
    <div className="min-h-screen">
      <Header slug="" user={user} onLogin={login} onLogout={logout} backTo={backTo} />

      <main className="max-w-4xl mx-auto px-4 pb-12">
        <div className="flex items-center justify-between gap-1 min-h-8 mb-3">
          <SearchInput value={searchQuery} onChange={setSearchQuery} />
          {isOwner && (
            <AddButton label="New suitcase" onClick={() => { setNewName(''); setCreateLoading(false); setCreating(true) }} />
          )}
        </div>

        {loading ? (
          <p className="text-(--muted) text-sm text-center mt-16">Loading…</p>
        ) : shownSuitcases.length === 0 ? (
          <p className="text-(--muted) text-sm text-center mt-16">{query ? 'No suitcases match your search.' : 'No suitcases yet.'}</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
            {shownSuitcases.map(suitcase => (
              <div
                key={suitcase.id}
                className="flex flex-col"
              >
                <Link
                  to={`/suitcases/${suitcase.id}`}
                  className="relative block aspect-square overflow-hidden p-3 card-fill"
                >
                  {suitcase.items.length === 0 ? (
                    <div className="w-full h-full flex items-center justify-center text-(--muted) text-xs">Empty</div>
                  ) : (
                    <div className="grid grid-cols-2 gap-1.5 w-full h-full">
                      {suitcase.items.slice(0, 4).map(item => (
                        <img key={`${item.slug}-${item.itemId}`} src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                      ))}
                    </div>
                  )}
                </Link>
                <div className="pt-1 px-0.5 flex items-center justify-between gap-1">
                  <Link to={`/suitcases/${suitcase.id}`} className="min-w-0 flex-1">
                    <div className="text-xs text-(--text) truncate">{suitcase.name ?? 'Untitled'}</div>
                    <div className="text-[10px] text-(--muted) leading-tight">{suitcase.items.length} item{suitcase.items.length === 1 ? '' : 's'}</div>
                  </Link>
                  {isOwner && (
                    <Menu
                      items={[
                        { label: 'Rename', onClick: () => { setRenameValue(suitcase.name ?? ''); setRenaming(suitcase) } },
                        { label: 'Delete', danger: true, onClick: () => handleDelete(suitcase) },
                      ]}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {creating && (
        <Modal locked={createLoading} onClose={() => setCreating(false)}>
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-(--text)">New suitcase</h2>
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="e.g. Lisbon trip"
              maxLength={60}
              className="field"
              disabled={createLoading}
            />
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setCreating(false)} disabled={createLoading} className="btn">
                Cancel
              </button>
              <button type="submit" disabled={createLoading} className="btn-primary">
                {createLoading ? '…' : 'Create'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {renaming && (
        <Modal locked={renameLoading} onClose={() => setRenaming(null)}>
          <form onSubmit={handleRename} className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-(--text)">Rename suitcase</h2>
            <input
              autoFocus
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              maxLength={60}
              className="field"
              disabled={renameLoading}
            />
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setRenaming(null)} disabled={renameLoading} className="btn">
                Cancel
              </button>
              <button type="submit" disabled={renameLoading} className="btn-primary">
                {renameLoading ? '…' : 'Save'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {toast && <Toast message={toast.msg} variant={toast.variant} />}
    </div>
  )
}
