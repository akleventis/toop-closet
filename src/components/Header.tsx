import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { User } from 'netlify-identity-widget'

type Props = {
  slug: string
  closets: string[]
  user: User | null
  onLogin: () => void
  onLogout: () => void
  onCreateCloset?: (slug: string) => Promise<void>
}

export default function Header({ slug, closets, user, onLogin, onLogout, onCreateCloset }: Props) {
  const [creating, setCreating] = useState(false)
  const [newSlug, setNewSlug] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!onCreateCloset) return
    setLoading(true)
    setError(null)
    try {
      await onCreateCloset(newSlug.trim())
      navigate(`/${newSlug.trim()}`)
      setCreating(false)
      setNewSlug('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create closet')
    } finally {
      setLoading(false)
    }
  }

  return (
    <header className="px-4 py-5 max-w-4xl mx-auto border-b border-[--border] mb-1">
      <div className="flex items-center justify-between">
        <h1 className="m-0 text-[1.1rem] font-semibold tracking-widest lowercase">{slug}'s closet</h1>
        <div className="flex items-center gap-2">
          {onCreateCloset && !creating && (
            <button
              onClick={() => setCreating(true)}
              className="px-3.5 py-1.5 border border-[--border] rounded text-sm font-medium hover:bg-[--bg-subtle] transition-colors"
            >
              + New closet
            </button>
          )}
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
      {creating && (
        <form onSubmit={handleSubmit} className="flex items-center gap-2 mt-3">
          <input
            autoFocus
            value={newSlug}
            onChange={e => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
            placeholder="closet-name"
            className="px-2.5 py-1.5 border border-[--border] rounded text-sm bg-[--bg] text-[--text] w-40 focus:outline-none"
            disabled={loading}
          />
          <button type="submit" disabled={loading || !newSlug.trim()} className="px-3 py-1.5 bg-[--text] text-[--bg] rounded text-sm font-medium disabled:opacity-40">
            {loading ? '…' : 'Create'}
          </button>
          <button type="button" onClick={() => { setCreating(false); setNewSlug(''); setError(null) }} className="px-3 py-1.5 border border-[--border] rounded text-sm hover:bg-[--bg-subtle]">
            Cancel
          </button>
          {error && <span className="text-[--danger] text-sm">{error}</span>}
        </form>
      )}
      {closets.length > 1 && (
        <nav className="flex gap-3 mt-3">
          {closets.map(s => (
            <Link
              key={s}
              to={`/${s}`}
              className={`text-sm lowercase tracking-wide transition-colors ${s === slug ? 'text-[--text] font-medium' : 'text-[--muted] hover:text-[--text]'}`}
            >
              {s}
            </Link>
          ))}
        </nav>
      )}
    </header>
  )
}
