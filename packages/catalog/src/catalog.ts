import { drinksProducts } from './categories/drinks.js';
import { householdProducts } from './categories/household.js';
import { impossibleProducts } from './categories/impossible.js';
import { outdoorsProducts } from './categories/outdoors.js';
import { pantryProducts } from './categories/pantry.js';
import { performanceProducts } from './categories/performance.js';
import { questionableProducts } from './categories/questionable.js';
import type { CatalogProduct } from './model.js';
const withPackagingConsumption = <T extends CatalogProduct>(products: readonly T[]) =>
  products.map((product) => ({
    ...product,
    packaging: {
      ...product.packaging,
      consumptionLabel: product.packaging.consumptionLabel ?? product.consumption_warning ?? null,
    },
  }));
export const CATALOG_PRODUCTS = [
  ...withPackagingConsumption(pantryProducts),
  ...withPackagingConsumption(performanceProducts),
  ...withPackagingConsumption(drinksProducts),
  ...withPackagingConsumption(householdProducts),
  ...withPackagingConsumption(outdoorsProducts),
  ...withPackagingConsumption(questionableProducts),
  ...withPackagingConsumption(impossibleProducts),
] as const satisfies readonly CatalogProduct[];
export const CATALOG_ARTWORK_IDS = CATALOG_PRODUCTS.map((product) => product.image_set_id);
export const catalogProductById = new Map(CATALOG_PRODUCTS.map((product) => [product.id, product]));
export const catalogProductBySlug = new Map(
  CATALOG_PRODUCTS.map((product) => [product.slug, product]),
);
