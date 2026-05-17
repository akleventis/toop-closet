import { allSlugs } from '../lib/userConfig.js'
import type { HandlerEvent, HandlerResponse } from '../lib/types.js'

export const handler = async (_event: HandlerEvent): Promise<HandlerResponse> => ({
  statusCode: 200,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ slugs: await allSlugs() }),
})
