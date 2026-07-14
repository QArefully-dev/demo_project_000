import {
  CATALOG_ARTWORK_IDS,
  CATALOG_CATEGORIES,
  CATALOG_PRODUCTS,
  type CatalogCategory,
  validateCatalog,
} from '@shop/catalog';

export const POWDER_CATEGORIES = CATALOG_CATEGORIES;
export type PowderCategory = CatalogCategory;
export type PowderProduct = (typeof POWDER_CATALOG)[number];

// Transitional API-test compatibility; canonical data now belongs to @shop/catalog.
export const POWDER_CATALOG = CATALOG_PRODUCTS.map((product) => ({
  ...product,
  consumption_warning: product.packaging.consumptionLabel,
  visual: {
    label_color: product.packaging.labelColor,
    powder_color: product.packaging.powderColor,
    mark: product.packaging.mark,
    batch_code: product.packaging.batchCode,
  },
}));

export const POWDER_IMAGE_SET_IDS = CATALOG_ARTWORK_IDS;
export const validatePowderCatalog = validateCatalog;
