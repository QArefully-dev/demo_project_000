import { Type, type Static } from '@sinclair/typebox';
import { MoneyCents, PositiveIntegerString } from './common.js';

const NormalizedCatalogKey = Type.String({
  minLength: 1,
  maxLength: 64,
  pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$',
});
const CatalogLabel = Type.String({ minLength: 1, maxLength: 160 });
const UtcIsoInstant = Type.String({
  minLength: 24,
  maxLength: 24,
  pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$',
});

/** Canonical live-bag rendering data. Omitted for non-catalog products. */
export const ProductPackaging = Type.Object(
  {
    labelColor: Type.String(),
    powderColor: Type.String(),
    mark: Type.String(),
    batchCode: Type.String(),
    quantity: Type.String(),
    consumptionLabel: Type.Union([Type.String(), Type.Null()]),
  },
  { additionalProperties: false },
);
export type ProductPackaging = Static<typeof ProductPackaging>;

export const ProductTag = Type.Object(
  { key: NormalizedCatalogKey, label: CatalogLabel },
  { additionalProperties: false },
);
export type ProductTag = Static<typeof ProductTag>;

export const ProductSpecification = Type.Object(
  {
    key: NormalizedCatalogKey,
    label: CatalogLabel,
    valueKey: NormalizedCatalogKey,
    value: CatalogLabel,
  },
  { additionalProperties: false },
);
export type ProductSpecification = Static<typeof ProductSpecification>;

export const ProductSpecificationGroup = Type.Object(
  {
    key: NormalizedCatalogKey,
    label: CatalogLabel,
    order: Type.Integer({ minimum: 1 }),
    specifications: Type.Array(ProductSpecification, { maxItems: 8 }),
  },
  { additionalProperties: false },
);
export type ProductSpecificationGroup = Static<typeof ProductSpecificationGroup>;

export const Product = Type.Object(
  {
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
    mixable: Type.Boolean(),
    mixUnitGrams: Type.Optional(Type.Integer({ minimum: 1 })),
    createdAt: UtcIsoInstant,
    available: Type.Boolean(),
    tags: Type.Array(ProductTag, { maxItems: 16 }),
    specificationGroups: Type.Array(ProductSpecificationGroup, { maxItems: 3 }),
  },
  { additionalProperties: false },
);
export type Product = Static<typeof Product>;

export const ProductSpecificationFilter = Type.Object(
  {
    key: NormalizedCatalogKey,
    label: CatalogLabel,
    values: Type.Array(ProductTag, { minItems: 1, maxItems: 64 }),
  },
  { additionalProperties: false },
);
export type ProductSpecificationFilter = Static<typeof ProductSpecificationFilter>;

export const ProductSpecificationFilterGroup = Type.Object(
  {
    key: NormalizedCatalogKey,
    label: CatalogLabel,
    order: Type.Integer({ minimum: 1 }),
    specifications: Type.Array(ProductSpecificationFilter, { minItems: 1, maxItems: 8 }),
  },
  { additionalProperties: false },
);
export type ProductSpecificationFilterGroup = Static<typeof ProductSpecificationFilterGroup>;

/** Active-catalog metadata available to catalog filter controls. */
export const ProductFilterOptionsResponse = Type.Object(
  {
    tags: Type.Array(ProductTag, { maxItems: 64 }),
    specificationGroups: Type.Array(ProductSpecificationFilterGroup, { maxItems: 3 }),
  },
  { additionalProperties: false },
);
export type ProductFilterOptionsResponse = Static<typeof ProductFilterOptionsResponse>;
export const FilterOptionsResponse = ProductFilterOptionsResponse;
export type FilterOptionsResponse = ProductFilterOptionsResponse;

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
