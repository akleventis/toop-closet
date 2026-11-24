import { useState, useEffect, useMemo } from 'react'
import netlifyIdentity from 'netlify-identity-widget'
import type { User } from 'netlify-identity-widget'
import { getOwnProfile, fetchClosets } from '../api'
import type { UserCloset, Workspace } from '../types'

const IS_DEV = import.meta.env.DEV
const DEV_TOKEN = 'dev-bypass'
const DEV_USER = { token: { access_token: DEV_TOKEN } } as unknown as User
const ACTIVE_WS_KEY = 'toop.activeWorkspace'
// dev has no Identity, so logout is a local flag that survives reloads
const DEV_LOGGED_OUT_KEY = 'toop.devLoggedOut'
const devLoggedIn = () => localStorage.getItem(DEV_LOGGED_OUT_KEY) !== '1'

if (!IS_DEV) {
  netlifyIdentity.init({ APIUrl: 'https://closet.tooper.io/.netlify/identity' })
}

export { IS_DEV, DEV_TOKEN }

// For FitGeneration, which polls outside the tree and shouldn't stand up a second useAuth.
export const currentToken = (): string =>
  IS_DEV ? (devLoggedIn() ? DEV_TOKEN : '') : (netlifyIdentity.currentUser()?.token?.access_token ?? '')

export const currentWorkspace = (): string | undefined => localStorage.getItem(ACTIVE_WS_KEY) ?? undefined

export function useAuth() {
  const [user, setUser] = useState<User | null>(IS_DEV ? (devLoggedIn() ? DEV_USER : null) : netlifyIdentity.currentUser())
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  // Which workspace's closets the nav shows + where new resources land. Persisted so a switch survives reloads;
  const [activeEmail, setActiveEmail] = useState<string | null>(() => localStorage.getItem(ACTIVE_WS_KEY))
  const [allClosets, setAllClosets] = useState<UserCloset[]>([])
  const [closetsLoaded, setClosetsLoaded] = useState(false)

  const token = user?.token?.access_token ?? ''
  const isOwner = !!user

  const setActiveWorkspace = (email: string) => {
    localStorage.setItem(ACTIVE_WS_KEY, email)
    setActiveEmail(email)
  }

  // Load the user's workspaces; default the active one to their own if unset/stale.
  const loadProfile = (t: string) =>
    getOwnProfile(t).then(p => {
      setWorkspaces(p.workspaces)
      setActiveEmail(prev => {
        if (prev && p.workspaces.some(w => w.ownerEmail === prev)) return prev
        const fallback = p.workspaces.find(w => w.own)?.ownerEmail ?? p.workspaces[0]?.ownerEmail ?? null
        if (fallback) localStorage.setItem(ACTIVE_WS_KEY, fallback)
        return fallback
      })
    }).catch(console.error)

  const clearSession = () => {
    setUser(null)
    setWorkspaces([])
    setActiveEmail(null)
    localStorage.removeItem(ACTIVE_WS_KEY)
  }

  useEffect(() => {
    fetchClosets().then(setAllClosets).catch(() => {}).finally(() => setClosetsLoaded(true))
  }, [])

  useEffect(() => {
    if (IS_DEV) { if (devLoggedIn()) loadProfile(DEV_TOKEN); return }
    const currentUser = netlifyIdentity.currentUser()
    const t = currentUser?.token?.access_token ?? ''
    if (currentUser && t) loadProfile(t)
  }, [])

  useEffect(() => {
    if (IS_DEV) return
    const handleLogin = (u: User) => {
      setUser(u)
      netlifyIdentity.close()
      const t = u.token?.access_token ?? ''
      if (t) loadProfile(t)
    }
    netlifyIdentity.on('login', handleLogin)
    netlifyIdentity.on('logout', clearSession)
    return () => {
      netlifyIdentity.off('login', handleLogin)
      netlifyIdentity.off('logout', clearSession)
    }
  }, [])

  const login = IS_DEV
    ? () => { localStorage.removeItem(DEV_LOGGED_OUT_KEY); setUser(DEV_USER); loadProfile(DEV_TOKEN) }
    : () => netlifyIdentity.open()
  const logout = IS_DEV
    ? () => { localStorage.setItem(DEV_LOGGED_OUT_KEY, '1'); clearSession() }
    : () => netlifyIdentity.logout()

  // Resolve the active workspace object (fallback to own / first loaded).
  const active =
    workspaces.find(w => w.ownerEmail === activeEmail) ??
    workspaces.find(w => w.own) ??
    workspaces[0] ??
    null
  const userClosets = active?.closets ?? []
  const navClosets = isOwner ? userClosets : allClosets
  // Slugs the user may edit = closets across every workspace they can act in.
  const editableSlugs = useMemo(
    () => new Set(workspaces.flatMap(w => w.closets.map(c => c.slug))),
    [workspaces],
  )
  // Shared "back to closets" target: active workspace's first closet, else the public flagship.
  const backTarget = userClosets[0] ?? allClosets[0]
  const backTo = backTarget ? `/${backTarget.slug}` : '/'

  return {
    user, token, isOwner,
    workspaces, activeWorkspace: active?.ownerEmail ?? null, setActiveWorkspace,
    userClosets, navClosets, setWorkspaces, editableSlugs,
    allClosets, setAllClosets, closetsLoaded, backTo,
    login, logout,
  }
}
