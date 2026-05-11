export function parseUsers(): Map<string, string> {
  const raw = process.env.USERS ?? ''
  const map = new Map<string, string>()
  for (const pair of raw.split(',')) {
    const [slug, userId] = pair.trim().split(':')
    if (slug && userId) map.set(slug, userId)
  }
  return map
}

export function slugForUserId(userId: string): string | undefined {
  for (const [slug, uid] of parseUsers()) {
    if (uid === userId) return slug
  }
}
