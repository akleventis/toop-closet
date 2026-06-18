export const JSON_HEADERS = { 'Content-Type': 'application/json' } as const
export const SLUG_RE = /^[a-z0-9_-]{1,50}$/

export interface HandlerEvent {
  httpMethod: string
  body: string | null
  isBase64Encoded?: boolean
  queryStringParameters?: Record<string, string>
  headers: Record<string, string>
}

export interface NetlifyUser {
  email: string
  sub: string
  app_metadata?: Record<string, unknown>
}

export interface NetlifyContext {
  clientContext?: {
    user?: NetlifyUser
  }
}

export interface HandlerResponse {
  statusCode: number
  headers?: Record<string, string>
  body: string
  isBase64Encoded?: boolean
}
