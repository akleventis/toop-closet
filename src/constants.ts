export const CATEGORIES = ['Tee Shirts', 'Jackets', 'Pants/Shorts', 'Shoes', 'Misc'] as const
export type Category = typeof CATEGORIES[number]

export const SLUGS = ['toop', 'vanessa'] as const
export type Slug = typeof SLUGS[number]
