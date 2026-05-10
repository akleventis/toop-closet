import type { NetlifyContext, NetlifyUser } from './types.js'

export function requireAuth(context: NetlifyContext): NetlifyUser | null {
  return context?.clientContext?.user ?? null
}
