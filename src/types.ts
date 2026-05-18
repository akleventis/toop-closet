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
  notes?: string
}

export type SavePayload = Omit<ClothingItem, 'id'> & { id?: string }

export type ModalState =
  | { mode: 'add' }
  | { mode: 'edit'; item: ClothingItem }
