export type UserConfig = {
  slug: string
  categories: string[]
  name?: string
}

export type OwnProfile = {
  slugs: string[]
}

export type ClothingItem = {
  id: string
  name: string
  category: string
  imageUrl: string
  notes?: string
}

export type SavePayload = Omit<ClothingItem, 'id'> & { id?: string }

export type ModalState =
  | { mode: 'add' }
  | { mode: 'edit'; item: ClothingItem }
