import { useState, useRef, useEffect } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { User } from 'netlify-identity-widget'
import type { UserCloset } from '../types'
import Menu from './Menu'
import type { MenuItem } from './Menu'

type Props = {
  slug: string
  closets: UserCloset[]
  user: User | null
  onLogin: () => void
  onLogout: () => void
  onCreateCloset?: (name: string) => Promise<string>
  onRenameCloset?: () => void
  onDeleteCloset?: () => void
}

export default function Header({ slug, closets, user, onLogin, onLogout, onCreateCloset, onRenameCloset, onDeleteCloset }: Props) {
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [createLoading, setCreateLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (creating) setTimeout(() => inputRef.current?.focus(), 50)
  }, [creating])

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    if (!onCreateCloset || !newName.trim()) return
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

  const handleClose = () => { setCreating(false); setNewName(''); setCreateError(null) }

  const closetMenuItems: MenuItem[] = [
    ...(onRenameCloset ? [{ label: 'Rename closet', onClick: onRenameCloset }] : []),
    ...(onDeleteCloset ? [{ label: 'Delete closet', danger: true, onClick: onDeleteCloset }] : []),
  ]

  return (
    <>
      <header className="px-4 py-4 max-w-4xl mx-auto border-b border-[--border] mb-1">
        <div className="flex items-center justify-between gap-4">
          <nav className="flex items-center gap-3 flex-wrap">
            {closets.map(c => {
              const isActive = c.slug === slug
              const label = c.name ?? c.slug
              return (
                <span key={c.slug} className="flex items-center">
                  <Link
                    to={`/${c.slug}`}
                    className={`text-sm tracking-wide transition-colors ${isActive ? 'text-[--text] underline underline-offset-4' : 'text-[--muted] hover:text-[--text]'}`}
                  >
                    {label}
                  </Link>
                  {isActive && closetMenuItems.length > 0 && (
                    <Menu items={closetMenuItems} />
                  )}
                </span>
              )
            })}

            {onCreateCloset && (
              <button
                onClick={() => setCreating(true)}
                className="text-[--muted] hover:text-[--text] transition-colors leading-none w-8 h-8 flex items-center justify-center text-base"
                title="New closet"
              >
                +
              </button>
            )}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            {user ? (
              <button onClick={onLogout} className="px-2.5 py-0.5 text-sm text-[--muted] hover:text-[--text] transition-colors">
                Log out
              </button>
            ) : (
              <button onClick={onLogin} className="px-2.5 py-0.5 text-sm text-[--muted] hover:text-[--text] transition-colors">
                Log in
              </button>
            )}
          </div>
        </div>
      </header>

      {creating && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4" onClick={handleClose}>
          <form
            onSubmit={handleCreate}
            className="rounded-lg border border-[--border] p-6 w-full max-w-sm flex flex-col gap-4"
            style={{ backgroundColor: 'var(--bg)' }}
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold text-[--text]">New closet</h2>
            <input
              ref={inputRef}
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Closet name"
              maxLength={60}
              className="px-3 py-2 border border-[--border] rounded text-sm bg-[--bg] text-[--text] focus:outline-none w-full"
              disabled={createLoading}
            />
            {createError && <p className="text-[--danger] text-sm">{createError}</p>}
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={handleClose} className="px-3.5 py-1.5 border border-[--border] rounded text-sm hover:bg-[--bg-subtle] transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={createLoading || !newName.trim()} className="px-3.5 py-1.5 bg-[--text] text-[--bg] rounded text-sm font-medium disabled:opacity-40">
                {createLoading ? '…' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
