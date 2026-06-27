export type UserConfig = {
  slug: string
  categories: string[]
  name?: string
}

export type UserCloset = { slug: string; name?: string }

export type OwnProfile = {
  closets: UserCloset[]
}

export type ClothingItem = {
  id: string
  name: string
  category: string
  imageUrl: string
  imageUrls?: string[]
  notes?: string
}

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
