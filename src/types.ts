export type ClothingItem = {
  id: string
  name: string
  category: string
  imageUrl: string
}

export type SavePayload = Omit<ClothingItem, 'id'> & { id?: string }

export type ModalState =
  | { mode: 'add' }
  | { mode: 'edit'; item: ClothingItem }
