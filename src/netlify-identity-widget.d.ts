/// <reference types="vite/client" />

declare module 'netlify-identity-widget' {
  export interface Token {
    access_token: string
    token_type: string
    expires_at: number
  }

  export interface User {
    id: string
    email: string
    token?: Token
    user_metadata: Record<string, unknown>
  }

  const netlifyIdentity: {
    init(opts?: { container?: string; locale?: string; APIUrl?: string }): void
    open(tabName?: 'login' | 'signup'): void
    close(): void
    logout(): void
    currentUser(): User | null
    on(event: 'login', handler: (user: User) => void): void
    on(event: 'logout', handler: () => void): void
    on(event: 'init', handler: (user: User | null) => void): void
    on(event: 'error', handler: (err: Error) => void): void
    off(event: 'login', handler: (user: User) => void): void
    off(event: 'logout', handler: () => void): void
    off(event: string, handler: (...args: unknown[]) => void): void
  }

  export default netlifyIdentity
}
