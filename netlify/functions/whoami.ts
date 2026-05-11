import { requireAuth } from '../lib/auth.js'
import { slugForUserId } from '../lib/users.js'
import type { HandlerEvent, NetlifyContext, HandlerResponse } from '../lib/types.js'

const JSON_HEADERS = { 'Content-Type': 'application/json' }

export const handler = async (_event: HandlerEvent, context: NetlifyContext): Promise<HandlerResponse> => {
  const netlifyUser = requireAuth(context)
  if (!netlifyUser) {
    return { statusCode: 401, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Unauthorized' }) }
  }
  const slug = slugForUserId(netlifyUser.sub)
  if (!slug) {
    return { statusCode: 403, headers: JSON_HEADERS, body: JSON.stringify({ error: 'No closet assigned' }) }
  }
  return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ slug }) }
}
