import type { HandlerEvent, NetlifyContext, NetlifyUser } from './types.js'

function devUser(): NetlifyUser | null {
  if (process.env.NETLIFY_DEV === 'true' && process.env.DEV_USER_EMAIL) {
    return {
      email: process.env.DEV_USER_EMAIL,
      sub: process.env.DEV_USER_SUB ?? 'dev-local',
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

// Emails allowed to create fits: OWNER_EMAIL plus the comma-separated FITS_ALLOWED_EMAILS (case-insensitive). Separate from closet-item ownership.
export function canCreateFits(email: string | undefined): boolean {
  if (!email) return false
  const allowed = [process.env.OWNER_EMAIL, ...(process.env.FITS_ALLOWED_EMAILS ?? '').split(',')]
    .map(e => (e ?? '').trim().toLowerCase())
    .filter(Boolean)
  return allowed.includes(email.toLowerCase())
}
