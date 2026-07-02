import { readJson } from './s3.js'
import { readClosetConfig } from './userConfig.js'
import type { HandlerEvent, NetlifyContext, NetlifyUser } from './types.js'

function devUser(): NetlifyUser | null {
  // In local dev (netlify dev sets NETLIFY_DEV=true), act as the owner.
  if (process.env.NETLIFY_DEV === 'true' && process.env.OWNER_EMAIL) {
    return {
      email: process.env.OWNER_EMAIL,
      sub: 'dev-local',
      app_metadata: {},
    }
  }
  return null
}

export function requireAuth(context: NetlifyContext): NetlifyUser | null {
  return devUser() ?? context?.clientContext?.user ?? null
}

// Background functions (`-background` suffix) don't get `context.clientContext`
// populated from the Identity JWT, so resolve the user from the raw bearer token
// by validating it against GoTrue (which verifies the signature for us).
export async function requireAuthFromHeader(event: HandlerEvent): Promise<NetlifyUser | null> {
  const dev = devUser()
  if (dev) return dev

  const auth = event.headers.authorization ?? event.headers.Authorization
  if (!auth) return null

  const res = await fetch(`${process.env.URL}/.netlify/identity/user`, {
    headers: { Authorization: auth },
  })
  if (!res.ok) return null
  return (await res.json()) as NetlifyUser
}

// Workspace = owner email; every closet/fit/suitcase carries it as `ownerEmail`. Seats registry at `_users/seats.json` keyed by owner: { "<owner>": { name?, seats: [...] } }. See docs/ARCHITECTURE.md.
// A user may act in their own workspace plus any that lists them as a seat; missing/empty file = everyone fully isolated.
type WorkspaceConfig = { name?: string; seats?: string[] }
type SeatsMap = Record<string, WorkspaceConfig>

const SEATS_KEY = '_users/seats.json'
export const norm = (e: string) => e.trim().toLowerCase()

async function readSeats(): Promise<SeatsMap> {
  return (await readJson<SeatsMap>(SEATS_KEY)) ?? {}
}

// Every workspace (owner email) this user may act within: their own + seat-of.
export async function accessibleWorkspaces(user: NetlifyUser): Promise<string[]> {
  const email = norm(user.email)
  const seats = await readSeats()
  const workspaces = new Set<string>([email])
  for (const [owner, cfg] of Object.entries(seats)) {
    if ((cfg.seats ?? []).map(norm).includes(email)) workspaces.add(norm(owner))
  }
  return [...workspaces]
}

// Accessible workspaces with their display names (own first), reading the seats doc once.
// Feeds the profile endpoint, which maps each workspace's closets onto this list.
export async function workspaceProfile(user: NetlifyUser): Promise<{ email: string; name?: string }[]> {
  const email = norm(user.email)
  const seats = await readSeats()
  const nameOf = (e: string) => Object.entries(seats).find(([o]) => norm(o) === e)?.[1]?.name
  const out: { email: string; name?: string }[] = [{ email, name: nameOf(email) }]
  for (const [owner, cfg] of Object.entries(seats)) {
    const o = norm(owner)
    if (o !== email && (cfg.seats ?? []).map(norm).includes(email)) out.push({ email: o, name: cfg.name })
  }
  return out
}

// True if the user owns or is a seat of the workspace that owns the resource.
export async function canActOn(user: NetlifyUser, ownerEmail: string | undefined): Promise<boolean> {
  if (!ownerEmail) return false
  return (await accessibleWorkspaces(user)).includes(norm(ownerEmail))
}

// True if the user may write to the closet at `slug` — owns or is a seat of its workspace.
// Folds the repeated "read closet config → canActOn" check used by clothes + upload-url.
export async function canActOnCloset(user: NetlifyUser, slug: string): Promise<boolean> {
  const cfg = await readClosetConfig(slug)
  return !!cfg && (await canActOn(user, cfg.ownerEmail))
}

// Workspace a new resource lands in: the requested (active) one if the user may act there, else their own; null if they requested one they aren't a member of (caller 403s).
// No `requested` = own workspace.
export async function targetWorkspace(user: NetlifyUser, requested?: string): Promise<string | null> {
  const own = norm(user.email)
  if (!requested) return own
  const r = norm(requested)
  if (r === own) return own
  return (await accessibleWorkspaces(user)).includes(r) ? r : null
}
