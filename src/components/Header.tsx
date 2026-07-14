import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import type { User } from 'netlify-identity-widget'
import type { UserCloset, Workspace } from '../types'
import Menu from './Menu'
import type { MenuItem } from './Menu'
import Modal from './Modal'
import WorkspaceSwitcher from './WorkspaceSwitcher'

type Props = {
  slug?: string
  closets: UserCloset[]
  user: User | null
  onLogin: () => void
  onLogout: () => void
  onCreateCloset?: (name: string) => Promise<string>
  onRenameCloset?: () => void
  onDeleteCloset?: () => void
  workspaces?: Workspace[]
  activeWorkspace?: string | null
  onSwitchWorkspace?: (email: string) => void
  backTo?: string
}

export default function Header({ slug = '', closets, user, onLogin, onLogout, onCreateCloset, onRenameCloset, onDeleteCloset, workspaces = [], activeWorkspace, onSwitchWorkspace, backTo }: Props) {
  const location = useLocation()
  // Fits + suitcases pages share the "← Back to closets" treatment (no closet nav).
  const onSubPage = location.pathname === '/fits' || location.pathname.startsWith('/suitcases')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [createLoading, setCreateLoading] = useState(false)
  const navigate = useNavigate()

  const showSwitcher = !onSubPage && workspaces.length > 1 && !!onSwitchWorkspace

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

  const backToCloset = backTo ?? (closets[0] ? `/${closets[0].slug}` : '/')

  return (
    <>
      <header className="px-3 sm:px-4 py-4 max-w-4xl mx-auto border-b border-[--border] mb-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 min-w-0 flex-1">
            {onSubPage ? (
              <Link
                to={backToCloset}
                className="flex items-center gap-1 text-xs tracking-wide text-[--muted] hover:text-[--text] transition-colors shrink-0"
              >
                <span aria-hidden="true">←</span> Back to closets
              </Link>
            ) : (
              <>
                {showSwitcher && (
                  <WorkspaceSwitcher workspaces={workspaces} activeWorkspace={activeWorkspace} onSwitch={onSwitchWorkspace!} />
                )}
                <nav className="flex items-center gap-3 overflow-x-auto scrollbar-none min-w-0 flex-1">
                  {closets.map(c => {
                    const isActive = c.slug === slug
                    const label = c.name ?? c.slug
                    return (
                      <Link
                        key={c.slug}
                        to={`/${c.slug}`}
                        className={`text-xs tracking-wide transition-colors shrink-0 ${isActive ? 'text-[--text] underline underline-offset-4' : 'text-[--muted] hover:text-[--text]'}`}
                      >
                        {label}
                      </Link>
                    )
                  })}
                </nav>

                <div className="flex items-center shrink-0">
                  {onCreateCloset && (
                    <button
                      onClick={() => setCreating(true)}
                      className="text-[--muted] hover:text-[--text] transition-colors leading-none w-8 h-8 flex items-center justify-center text-base shrink-0"
                      title="New closet"
                    >
                      +
                    </button>
                  )}

                  {closetMenuItems.length > 0 && <Menu items={closetMenuItems} align="left" />}

                  <span className="w-px h-4 bg-[--border] shrink-0 mx-2" aria-hidden="true" />

                  <Link
                    to="/fits"
                    className="text-xs tracking-wide text-[--muted] hover:text-[--text] transition-colors shrink-0"
                  >
                    fits
                  </Link>
                  <Link
                    to="/suitcases"
                    className="text-xs tracking-wide text-[--muted] hover:text-[--text] transition-colors shrink-0 ml-3"
                  >
                    suitcases
                  </Link>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {user ? (
              <button onClick={onLogout} className="px-1.5 sm:px-2.5 py-0.5 text-xs text-[--muted] hover:text-[--text] transition-colors whitespace-nowrap">
                Log out
              </button>
            ) : (
              <button onClick={onLogin} className="px-1.5 sm:px-2.5 py-0.5 text-xs text-[--muted] hover:text-[--text] transition-colors whitespace-nowrap">
                Log in
              </button>
            )}
          </div>
        </div>
      </header>

      {creating && (
        <Modal onClose={handleClose}>
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-[--text]">New closet</h2>
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Closet name"
              maxLength={60}
              className="px-3 py-2 border border-[--border] rounded text-base sm:text-sm bg-[--bg] text-[--text] focus:outline-none w-full"
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
        </Modal>
      )}
    </>
  )
}
