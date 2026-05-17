import type { NetlifyContext, NetlifyUser } from './types.js'

export function requireAuth(context: NetlifyContext): NetlifyUser | null {
  if (process.env.NETLIFY_DEV === 'true' && process.env.DEV_USER_EMAIL) {
    return {
      email: process.env.DEV_USER_EMAIL,
      sub: process.env.DEV_USER_SUB ?? 'dev-local',
      app_metadata: {},
    }
  }
  return context?.clientContext?.user ?? null
}
