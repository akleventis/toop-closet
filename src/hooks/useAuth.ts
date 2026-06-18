import { useState, useEffect } from 'react'
import netlifyIdentity from 'netlify-identity-widget'
import type { User } from 'netlify-identity-widget'
import { getOwnProfile, fetchClosets } from '../api'
import type { UserCloset } from '../types'

const IS_DEV = import.meta.env.DEV
const DEV_TOKEN = 'dev-bypass'
const DEV_USER = { token: { access_token: DEV_TOKEN } } as unknown as User

if (!IS_DEV) {
  netlifyIdentity.init({ APIUrl: 'https://closet.tooper.io/.netlify/identity' })
}

export { IS_DEV, DEV_TOKEN }

export function useAuth() {
  const [user, setUser] = useState<User | null>(IS_DEV ? DEV_USER : netlifyIdentity.currentUser())
  const [userClosets, setUserClosets] = useState<UserCloset[]>([])
  const [allClosets, setAllClosets] = useState<UserCloset[]>([])

  const token = user?.token?.access_token ?? ''
  const isOwner = !!user

  useEffect(() => {
    fetchClosets().then(setAllClosets).catch(() => {})
  }, [])

  useEffect(() => {
    if (IS_DEV) {
      getOwnProfile(DEV_TOKEN).then(p => setUserClosets(p.closets)).catch(console.error)
      return
    }
    const currentUser = netlifyIdentity.currentUser()
    const t = currentUser?.token?.access_token ?? ''
    if (currentUser && t) getOwnProfile(t).then(p => setUserClosets(p.closets)).catch(console.error)
  }, [])

  useEffect(() => {
    if (IS_DEV) return
    const handleLogin = (u: User) => {
      setUser(u)
      netlifyIdentity.close()
      const t = u.token?.access_token ?? ''
      if (t) getOwnProfile(t).then(p => setUserClosets(p.closets)).catch(console.error)
    }
    const handleLogout = () => { setUser(null); setUserClosets([]) }
    netlifyIdentity.on('login', handleLogin)
    netlifyIdentity.on('logout', handleLogout)
    return () => {
      netlifyIdentity.off('login', handleLogin)
      netlifyIdentity.off('logout', handleLogout)
    }
  }, [])

  const login = IS_DEV ? () => {} : () => netlifyIdentity.open()
  const logout = IS_DEV ? () => {} : () => netlifyIdentity.logout()

  return { user, token, isOwner, userClosets, setUserClosets, allClosets, setAllClosets, login, logout }
}
