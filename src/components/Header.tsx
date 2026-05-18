import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { User } from 'netlify-identity-widget'
import type { UserCloset } from '../types'

type Props = {
  slug: string
  closets: UserCloset[]
  user: User | null
  onLogin: () => void
  onLogout: () => void
  onCreateCloset?: (name: string) => Promise<string>
}

export default function Header({ slug, closets, user, onLogin, onLogout, onCreateCloset }: Props) {
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [createLoading, setCreateLoading] = useState(false)
  const navigate = useNavigate()

  const handleCreateSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!onCreateCloset) return
    setCreateLoading(true)
    setCreateError(null)
    try {
      const generatedSlug = await onCreateCloset(newName.trim())
      navigate(`/${generatedSlug}`)
      setCreating(false)
      setNewName('')
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
          {closets.map(c => {
            const isActive = c.slug === slug
            const label = c.name ?? c.slug
            return (
              <Link
                key={c.slug}
                to={`/${c.slug}`}
                className={`text-sm font-semibold tracking-wide transition-colors ${isActive ? 'text-[--text]' : 'text-[--muted] hover:text-[--text]'}`}
              >
                {label}
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
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Closet name"
                maxLength={60}
                className="px-2 py-1 border border-[--border] rounded text-sm bg-[--bg] text-[--text] w-36 focus:outline-none"
                disabled={createLoading}
              />
              <button type="submit" disabled={createLoading || !newName.trim()} className="px-2.5 py-1 bg-[--text] text-[--bg] rounded text-sm font-medium disabled:opacity-40">
                {createLoading ? '…' : 'Create'}
              </button>
              <button type="button" onClick={() => { setCreating(false); setNewName(''); setCreateError(null) }} className="px-2.5 py-1 border border-[--border] rounded text-sm hover:bg-[--bg-subtle]">
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
