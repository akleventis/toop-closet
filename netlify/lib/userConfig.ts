const usersMap: Record<string, string> = (() => {
  try { return JSON.parse(process.env.USERS_JSON ?? '{}') as Record<string, string> }
  catch { return {} }
})()

export function slugForEmail(email: string): string | undefined {
  return Object.keys(usersMap).find(slug => usersMap[slug] === email)
}

export function isValidSlug(slug: string): boolean {
  return Object.prototype.hasOwnProperty.call(usersMap, slug)
}

export function allSlugs(): string[] {
  return Object.keys(usersMap)
}
