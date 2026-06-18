import { allSlugs, readClosetConfig } from '../lib/userConfig.js'
import type { ClosetConfig } from '../lib/userConfig.js'
import { JSON_HEADERS } from '../lib/types.js'
import type { HandlerEvent, HandlerResponse } from '../lib/types.js'

export const handler = async (_event: HandlerEvent): Promise<HandlerResponse> => {
  const slugs = await allSlugs()
  const ownerEmail = process.env.OWNER_EMAIL
  const configs = await Promise.all(slugs.map(slug => readClosetConfig(slug)))
  const closets = configs
    .filter((c): c is ClosetConfig => c !== null && (!ownerEmail || c.ownerEmail === ownerEmail))
    .map(c => ({ slug: c.slug, name: c.name }))
  return {
    statusCode: 200,
    headers: JSON_HEADERS,
    body: JSON.stringify({ closets }),
  }
}
