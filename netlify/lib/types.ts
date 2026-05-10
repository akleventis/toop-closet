export interface HandlerEvent {
  httpMethod: string
  body: string | null
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
}
