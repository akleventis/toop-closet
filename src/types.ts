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
