import {
  CATALOG_PRODUCTS,
  CATALOG_SPECIFICATION_GROUPS,
  catalogProductSpecifications,
} from '@shop/catalog';
import type { Product } from '@shop/contracts/products';
import type { ProductRow } from '../features/catalog/productRepository.js';

const packagingByArtworkId = new Map<string, (typeof CATALOG_PRODUCTS)[number]['packaging']>(
  CATALOG_PRODUCTS.map((product) => [product.image_set_id, product.packaging]),
);

/** Maps a persisted product row to the transport contract and resolves canonical packaging. */
export function toProductContract(row: ProductRow): Product {
  const imageSetId = row.image_set_id ?? 'unknown';
  const catalogProduct = CATALOG_PRODUCTS.find((product) => product.image_set_id === imageSetId);
  const packaging = packagingByArtworkId.get(imageSetId);
  const tags = catalogProduct?.tags.map(({ key, label }) => ({ key, label })) ?? [];
  const specificationGroups = catalogProduct
    ? [...catalogProductSpecifications(catalogProduct)]
        .sort(
          (left, right) =>
            CATALOG_SPECIFICATION_GROUPS.findIndex((group) => group.key === left.group) -
              CATALOG_SPECIFICATION_GROUPS.findIndex((group) => group.key === right.group) ||
            left.order - right.order,
        )
        .reduce<Product['specificationGroups']>((groups, specification) => {
          let group = groups.find((candidate) => candidate.key === specification.group);
          if (!group) {
            group = {
              key: specification.group,
              label: specification.groupLabel,
              order: CATALOG_SPECIFICATION_GROUPS.find(
                (candidate) => candidate.key === specification.group,
              )!.order,
              specifications: [],
            };
            groups.push(group);
          }
          group.specifications.push({
            key: specification.key,
            label: specification.label,
            valueKey: specification.valueKey,
            value: specification.displayValue,
          });
          return groups;
        }, [])
    : [];

  return {
    id: String(row.id),
    name: row.name,
    description: row.description,
    priceCents: row.price_cents,
    imageSetId,
    ...(packaging ? { packaging } : {}),
    category: row.category,
    stock: row.stock_count,
    slug: row.slug ?? '',
    compareAtPriceCents: row.compare_at_price_cents ?? undefined,
    salesCount: row.sales_count ?? 0,
    mixable: row.mixable === 1,
    mixUnitGrams: row.mix_unit_grams ?? undefined,
    createdAt: row.created_at,
    available: row.active === 1 && row.stock_count > 0,
    tags,
    specificationGroups,
  };
}
