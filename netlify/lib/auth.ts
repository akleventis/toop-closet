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
