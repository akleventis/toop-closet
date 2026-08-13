export type UserConfig = {
  slug: string
  categories: string[]
  name?: string
}

export type UserCloset = { slug: string; name?: string }

// A workspace the logged-in user can act in: their own, or one they're a seat of.
export type Workspace = { ownerEmail: string; own: boolean; name?: string; closets: UserCloset[] }

export type OwnProfile = {
  workspaces: Workspace[]
  closets: UserCloset[] // own workspace's closets (back-compat)
}

export type ClothingItem = {
  id: string
  name: string
  category: string
  imageUrl: string
  imageUrls?: string[]
  notes?: string
  // Written only by remove-bg-background; a fresh bgPendingAt means a job is running.
  bgPendingAt?: string
  bgError?: string
  bgRetry?: number[]   // image slots that still need removal after a failure — retry needs no re-upload
}

// Longer than the NAS timeout + upload; past this a bgPendingAt is a crashed job, not a live one.
const BG_STALE_MS = 5 * 60 * 1000

export const isBgPending = (item: ClothingItem): boolean =>
  !!item.bgPendingAt && Date.now() - Date.parse(item.bgPendingAt) < BG_STALE_MS

export function getImages(item: ClothingItem): string[] {
  if (item.imageUrls?.length) return item.imageUrls
  return item.imageUrl ? [item.imageUrl] : []
}

export type SavePayload = Omit<ClothingItem, 'id'> & { id?: string }

export type ModalState =
  | { mode: 'add'; defaultCategory?: string }
  | { mode: 'edit'; item: ClothingItem }

export type FitItem = {
  itemId: string
  slug: string
  name: string
  imageUrl: string
}

export type Fit = {
  id: string
  name?: string
  imageUrl: string
  items: FitItem[]
  context?: string   // styling direction; pre-fills the textarea on edit
  suitcaseId?: string // set when the fit was generated from a suitcase (groups it on that suitcase's page)
  createdAt: string
}

// A trip "suitcase": a named collection of packed items (FitItem snapshots, same shape as fits).
// Fits generated from it are scoped to these items and carry its id as suitcaseId.
export type Suitcase = {
  id: string
  name?: string
  items: FitItem[]
  createdAt: string
}
