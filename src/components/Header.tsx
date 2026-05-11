import { Link } from 'react-router-dom'
import type { User } from 'netlify-identity-widget'
import { SLUGS } from '../constants'

type Props = {
  slug: string
  user: User | null
  onLogin: () => void
  onLogout: () => void
}

export default function Header({ slug, user, onLogin, onLogout }: Props) {
  return (
    <header className="px-4 py-5 max-w-4xl mx-auto border-b border-[--border] mb-1">
      <div className="flex items-center justify-between">
        <h1 className="m-0 text-[1.1rem] font-semibold tracking-widest lowercase">{slug}'s closet</h1>
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
      <nav className="flex gap-3 mt-3">
        {SLUGS.map(s => (
          <Link
            key={s}
            to={`/${s}`}
            className={`text-sm lowercase tracking-wide transition-colors ${s === slug ? 'text-[--text] font-medium' : 'text-[--muted] hover:text-[--text]'}`}
          >
            {s}
          </Link>
        ))}
      </nav>
    </header>
  )
}
