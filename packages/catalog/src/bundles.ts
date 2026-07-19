/** Fixed product-only collections. Current prices and availability remain persisted runtime facts. */
export type CatalogBundleComponent = Readonly<{
  productId: number;
  quantity: number;
  sortOrder: number;
}>;

export type CatalogBundle = Readonly<{
  id: number;
  key: string;
  name: string;
  description: string;
  sortOrder: number;
  components: readonly CatalogBundleComponent[];
}>;

export const CURATED_BUNDLES = [
  {
    id: 1,
    key: 'powder-starter-set',
    name: 'Starter Set',
    description: 'Protein Powder, Powdered Oats, and Cocoa Powder.',
    sortOrder: 1,
    components: [
      { productId: 1, quantity: 1, sortOrder: 1 },
      { productId: 2, quantity: 1, sortOrder: 2 },
      { productId: 3, quantity: 1, sortOrder: 3 },
    ],
  },
  {
    id: 2,
    key: 'pantry-set',
    name: 'Pantry Set',
    description: 'Tomato Powder, Mushroom Powder, and Roasted Garlic Powder.',
    sortOrder: 2,
    components: [
      { productId: 5, quantity: 1, sortOrder: 1 },
      { productId: 6, quantity: 1, sortOrder: 2 },
      { productId: 7, quantity: 1, sortOrder: 3 },
    ],
  },
  {
    id: 3,
    key: 'outdoor-kit',
    name: 'Outdoor Kit',
    description: 'Campfire, Trail Dust Powder, and Pine Needle Powder.',
    sortOrder: 3,
    components: [
      { productId: 27, quantity: 1, sortOrder: 1 },
      { productId: 29, quantity: 1, sortOrder: 2 },
      { productId: 31, quantity: 1, sortOrder: 3 },
    ],
  },
  {
    id: 4,
    key: 'questionable-assortment',
    name: 'Questionable Assortment',
    description: 'Powdered Tuesday, Powdered Meeting, and Powdered Queue.',
    sortOrder: 4,
    components: [
      { productId: 35, quantity: 1, sortOrder: 1 },
      { productId: 36, quantity: 1, sortOrder: 2 },
      { productId: 38, quantity: 1, sortOrder: 3 },
    ],
  },
] as const satisfies readonly CatalogBundle[];
