import type { User } from 'netlify-identity-widget'

type Props = {
  user: User | null
  onLogin: () => void
  onLogout: () => void
}

export default function Header({ user, onLogin, onLogout }: Props) {
  return (
    <header className="flex items-center justify-between px-4 py-5 max-w-4xl mx-auto border-b border-[--border] mb-1">
      <h1 className="m-0 text-[1.1rem] font-semibold tracking-widest lowercase">inventory</h1>
      {user ? (
        <button onClick={onLogout} className="px-3.5 py-1.5 border border-[--border] rounded text-sm font-medium hover:bg-[--bg-subtle] transition-colors">
          Log out
        </button>
      ) : (
        <button onClick={onLogin} className="px-3.5 py-1.5 border border-[--border] rounded text-sm font-medium hover:bg-[--bg-subtle] transition-colors">
          Admin login
        </button>
      )}
    </header>
  )
}
