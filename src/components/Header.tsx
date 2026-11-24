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
  closets?: UserCloset[]
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

export default function Header({ slug = '', closets = [], user, onLogin, onLogout, onCreateCloset, onRenameCloset, onDeleteCloset, workspaces = [], activeWorkspace, onSwitchWorkspace, backTo }: Props) {
  const location = useLocation()
  const onFits = location.pathname === '/fits'
  const onSuitcases = location.pathname.startsWith('/suitcases')
  const onSubPage = onFits || onSuitcases
  const inSuitcase = location.pathname.startsWith('/suitcases/')
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
    ...(onCreateCloset ? [{ label: 'Add closet', onClick: () => setCreating(true) }] : []),
    ...(onRenameCloset ? [{ label: 'Rename closet', onClick: onRenameCloset }] : []),
    ...(onDeleteCloset ? [{ label: 'Delete closet', danger: true, onClick: onDeleteCloset }] : []),
  ]

  return (
    <>
      <header className="px-3 sm:px-4 pt-3 pb-1.5 max-w-4xl mx-auto">
        <div className="flex items-center justify-between gap-2 min-h-8">
          <div className="flex items-center gap-1 min-w-0 flex-1">
            {showSwitcher && (
              <WorkspaceSwitcher workspaces={workspaces} activeWorkspace={activeWorkspace} onSwitch={onSwitchWorkspace!} />
            )}
            {onSubPage ? (
              <Link to={inSuitcase ? '/suitcases' : backTo ?? '/'} className="flex items-center gap-1 text-xs font-medium text-(--muted) hover:text-(--text) transition-colors shrink-0 mr-auto">
                <span aria-hidden="true">←</span> {inSuitcase ? 'Suitcases' : 'Closets'}
              </Link>
            ) : (
              <nav className="flex items-center gap-3 overflow-x-auto scrollbar-none min-w-0 flex-1">
                {closets.map(c => {
                  const isActive = c.slug === slug
                  const label = c.name ?? c.slug
                  return (
                    <Link
                      key={c.slug}
                      to={`/${c.slug}`}
                      className={`text-xs font-medium transition-colors shrink-0 ${isActive ? 'text-(--text)' : 'text-(--muted) hover:text-(--text)'}`}
                    >
                      {label}
                    </Link>
                  )
                })}
              </nav>
            )}

            <div className="flex items-center shrink-0">
              {closetMenuItems.length > 0 && <Menu items={closetMenuItems} align="left" />}

              <span className="w-px h-4 bg-(--border) shrink-0 mx-2" aria-hidden="true" />

              <Link
                to="/fits"
                className={`text-xs font-medium transition-colors shrink-0 ${onFits ? 'text-(--text)' : 'text-(--muted) hover:text-(--text)'}`}
              >
                Fits
              </Link>
              <Link
                to="/suitcases"
                className={`text-xs font-medium transition-colors shrink-0 ml-3 ${onSuitcases ? 'text-(--text)' : 'text-(--muted) hover:text-(--text)'}`}
              >
                Suitcases
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {user ? (
              <button onClick={onLogout} className="px-1.5 sm:px-2.5 py-0.5 text-xs font-medium text-(--muted) hover:text-(--text) transition-colors whitespace-nowrap">
                Log out
              </button>
            ) : (
              <button onClick={onLogin} className="px-1.5 sm:px-2.5 py-0.5 text-xs font-medium text-(--muted) hover:text-(--text) transition-colors whitespace-nowrap">
                Log in
              </button>
            )}
          </div>
        </div>
      </header>

      {creating && (
        <Modal onClose={handleClose}>
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-(--text)">New closet</h2>
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Closet name"
              maxLength={60}
              className="field"
              disabled={createLoading}
            />
            {createError && <p className="text-(--danger) text-xs">{createError}</p>}
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={handleClose} className="btn">
                Cancel
              </button>
              <button type="submit" disabled={createLoading || !newName.trim()} className="btn-primary">
                {createLoading ? '…' : 'Create'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
