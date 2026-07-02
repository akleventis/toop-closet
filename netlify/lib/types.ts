export const JSON_HEADERS = { 'Content-Type': 'application/json' } as const
export const SLUG_RE = /^[a-z0-9_-]{1,50}$/

// JSON error response + the two most common cases, so handlers stop hand-rolling the literal.
export const errorRes = (statusCode: number, error: string): HandlerResponse => ({ statusCode, headers: JSON_HEADERS, body: JSON.stringify({ error }) })
export const forbidden = (): HandlerResponse => errorRes(403, 'Forbidden')
export const unauthorized = (): HandlerResponse => errorRes(401, 'Unauthorized')

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
