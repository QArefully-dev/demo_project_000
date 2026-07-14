import { Type, type Static } from '@sinclair/typebox';
import { MoneyCents, PositiveIntegerString } from './common.js';

/** Canonical live-bag rendering data. Omitted for non-catalog products. */
export const ProductPackaging = Type.Object({
  labelColor: Type.String(),
  powderColor: Type.String(),
  mark: Type.String(),
  batchCode: Type.String(),
  quantity: Type.String(),
  consumptionLabel: Type.Union([Type.String(), Type.Null()]),
});
export type ProductPackaging = Static<typeof ProductPackaging>;

export const Product = Type.Object({
  id: PositiveIntegerString,
  name: Type.String(),
  description: Type.String(),
  priceCents: MoneyCents,
  imageSetId: Type.String(),
  packaging: Type.Optional(ProductPackaging),
  category: Type.String(),
  stock: Type.Integer({ minimum: 0 }),
  slug: Type.String(),
  compareAtPriceCents: Type.Optional(MoneyCents),
  salesCount: Type.Integer({ minimum: 0 }),
});
export type Product = Static<typeof Product>;

export const ProductSort = Type.Union([
  Type.Literal('newest'),
  Type.Literal('price_asc'),
  Type.Literal('price_desc'),
  Type.Literal('bestselling'),
]);

export const ProductQuery = Type.Object({
  q: Type.Optional(Type.String({ maxLength: 200 })),
  category: Type.Optional(Type.String({ maxLength: 100 })),
  onSale: Type.Optional(Type.Boolean()),
  sort: Type.Optional(ProductSort),
  page: Type.Optional(Type.Integer({ minimum: 1, maximum: 10000 })),
  pageSize: Type.Optional(Type.Integer({ minimum: 1, maximum: 48 })),
});
export type ProductQuery = Static<typeof ProductQuery>;

export const ProductListPaginatedResponse = Type.Object({
  items: Type.Array(Product),
  total: Type.Integer({ minimum: 0 }),
  page: Type.Integer({ minimum: 1 }),
  pageSize: Type.Integer({ minimum: 1 }),
});
export type ProductListPaginatedResponse = Static<typeof ProductListPaginatedResponse>;

export const CategoriesResponse = Type.Array(Type.String());
export type CategoriesResponse = Static<typeof CategoriesResponse>;
export const BestsellersResponse = Type.Array(Product);
export type BestsellersResponse = Static<typeof BestsellersResponse>;
export const RelatedResponse = Type.Array(Product);
export type RelatedResponse = Static<typeof RelatedResponse>;
export const ProductListResponse = Type.Array(Product);
export type ProductListResponse = Static<typeof ProductListResponse>;
export const ProductDetailResponse = Product;
export type ProductDetailResponse = Static<typeof ProductDetailResponse>;

export const ProductIdParam = Type.Object({ id: PositiveIntegerString });
