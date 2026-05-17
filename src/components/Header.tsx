import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { User } from 'netlify-identity-widget'

type Props = {
  slug: string
  closets: string[]
  user: User | null
  closetName?: string
  onLogin: () => void
  onLogout: () => void
  onCreateCloset?: (slug: string) => Promise<void>
}

export default function Header({ slug, closets, user, closetName, onLogin, onLogout, onCreateCloset }: Props) {
  const [creating, setCreating] = useState(false)
  const [newSlug, setNewSlug] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [createLoading, setCreateLoading] = useState(false)
  const navigate = useNavigate()

  const handleCreateSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!onCreateCloset) return
    setCreateLoading(true)
    setCreateError(null)
    try {
      await onCreateCloset(newSlug.trim())
      navigate(`/${newSlug.trim()}`)
      setCreating(false)
      setNewSlug('')
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create closet')
    } finally {
      setCreateLoading(false)
    }
  }

  return (
    <header className="px-4 py-4 max-w-4xl mx-auto border-b border-[--border] mb-1">
      <div className="flex items-center justify-between gap-4">
        <nav className="flex items-center gap-4 flex-wrap">
          {closets.map(s => {
            const isActive = s === slug
            return (
              <Link
                key={s}
                to={`/${s}`}
                className={`text-sm lowercase tracking-wide transition-colors ${isActive ? 'text-[--text] font-semibold' : 'text-[--muted] hover:text-[--text]'}`}
              >
                {isActive ? (closetName ?? s) : s}
              </Link>
            )
          })}

          {onCreateCloset && !creating && (
            <button
              onClick={() => setCreating(true)}
              className="text-[--muted] hover:text-[--text] transition-colors leading-none w-5 h-5 flex items-center justify-center text-base"
              title="New closet"
            >
              +
            </button>
          )}
          {creating && (
            <form onSubmit={handleCreateSubmit} className="flex items-center gap-2">
              <input
                autoFocus
                value={newSlug}
                onChange={e => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                placeholder="closet-name"
                className="px-2 py-1 border border-[--border] rounded text-sm bg-[--bg] text-[--text] w-32 focus:outline-none"
                disabled={createLoading}
              />
              <button type="submit" disabled={createLoading || !newSlug.trim()} className="px-2.5 py-1 bg-[--text] text-[--bg] rounded text-sm font-medium disabled:opacity-40">
                {createLoading ? '…' : 'Create'}
              </button>
              <button type="button" onClick={() => { setCreating(false); setNewSlug(''); setCreateError(null) }} className="px-2.5 py-1 border border-[--border] rounded text-sm hover:bg-[--bg-subtle]">
                Cancel
              </button>
              {createError && <span className="text-[--danger] text-sm">{createError}</span>}
            </form>
          )}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          {user ? (
            <button onClick={onLogout} className="px-3.5 py-1.5 border border-[--border] rounded text-sm font-medium hover:bg-[--bg-subtle] transition-colors">
              Log out
            </button>
          ) : (
            <button onClick={onLogin} className="px-3.5 py-1.5 border border-[--border] rounded text-sm font-medium hover:bg-[--bg-subtle] transition-colors">
              Log in
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
