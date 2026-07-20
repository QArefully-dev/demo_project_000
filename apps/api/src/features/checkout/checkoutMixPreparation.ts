import { CATALOG_PRODUCTS } from '@shop/catalog';
import type { PowderMixCartItem } from '@shop/contracts/powderizer';
import {
  calculatePowderMixStockRequirements,
  derivePowderMixUsageLabel,
  quotePowderMix,
} from '../powderizer/powderMixRules.js';
import type { PowderMixProduct, PowderMixStockRequirement } from '../powderizer/powderizerTypes.js';
import type { CheckoutDependencies, CheckoutResult } from './checkoutTypes.js';

type MixPreparation =
  | { requirements: readonly PowderMixStockRequirement[]; mixItems: PowderMixCartItem[] }
  | Extract<CheckoutResult, { success: false }>;

function toMixProduct(
  row: NonNullable<ReturnType<CheckoutDependencies['products']['findById']>>,
): PowderMixProduct {
  const canonicalProduct = CATALOG_PRODUCTS.find((product) => product.id === row.id);
  const isNonFood = canonicalProduct?.baseFacts.consumptionClassification !== 'food';
  return {
    id: row.id,
    name: row.name,
    priceCents: row.price_cents,
    mixable: row.mixable === 1,
    mixUnitGrams: row.mix_unit_grams ?? null,
    consumptionWarning: isNonFood ? 'Not for consumption' : null,
    mixingGroup: row.mixing_group ?? null,
    blendSourceVariantId: row.blend_source_variant_id ?? null,
    detailsJson: row.details_json ?? null,
    sourceVariantPriceCents: null,
    sourceVariantMixUnitGrams: null,
  };
}

function resolveSourceVariant(
  product: PowderMixProduct,
  findVariantById: CheckoutDependencies['products']['findVariantById'],
): void {
  if (product.blendSourceVariantId == null) return;
  const variant = findVariantById(product.blendSourceVariantId);
  if (!variant) return;
  product.sourceVariantPriceCents = variant.price_cents;
  product.sourceVariantMixUnitGrams = variant.weight_grams;
}

export function prepareMixes(cartId: string, dependencies: CheckoutDependencies): MixPreparation {
  let persisted: ReturnType<CheckoutDependencies['mixes']['listForCart']>;
  try {
    persisted = dependencies.mixes.listForCart(cartId);
  } catch {
    return { success: false, error: 'MIX_REQUOTE_REQUIRED', mixes: [] };
  }
  const stockLines: Array<{
    allocations: Array<{ productId: number; allocatedGrams: number }>;
    quantity: number;
  }> = [];
  const requotes: Array<{ mixId: string; oldUnitPriceCents: number; newUnitPriceCents: number }> =
    [];
  const mixItems: PowderMixCartItem[] = [];

  for (const mix of persisted) {
    const components = mix.components.map((component) => ({
      productId: component.product_id,
      percentage: component.percentage,
    }));
    const componentRows = components.map((component) =>
      dependencies.products.findById(component.productId),
    );
    if (componentRows.some((product) => product === undefined || product.active !== 1)) {
      requotes.push({
        mixId: mix.id,
        oldUnitPriceCents: mix.quoted_unit_price_cents,
        newUnitPriceCents: mix.quoted_unit_price_cents,
      });
      continue;
    }
    const products = (componentRows as Array<NonNullable<(typeof componentRows)[number]>>).map(
      toMixProduct,
    );
    products.forEach((p) => resolveSourceVariant(p, dependencies.products.findVariantById));
    try {
      const quoted = quotePowderMix(
        {
          components: components.map((component) => ({
            ...component,
            productId: String(component.productId),
          })),
          bagSizeGrams: mix.bag_size_grams,
          fineness: mix.fineness,
          customLabel: mix.custom_label ?? undefined,
          bagColourScheme: mix.bag_colour_scheme,
        },
        products,
      );
      if (
        quoted.priceVersion !== mix.price_version ||
        quoted.unitPriceCents !== mix.quoted_unit_price_cents ||
        quoted.config.bagColourScheme !== mix.bag_colour_scheme ||
        quoted.allocations.some(
          (allocation) =>
            !mix.components.some(
              (component) =>
                component.product_id === allocation.productId &&
                component.percentage === allocation.percentage &&
                component.allocated_grams === allocation.allocatedGrams,
            ),
        )
      ) {
        requotes.push({
          mixId: mix.id,
          oldUnitPriceCents: mix.quoted_unit_price_cents,
          newUnitPriceCents: quoted.unitPriceCents,
        });
        continue;
      }
      stockLines.push({ allocations: [...quoted.allocations], quantity: mix.quantity });
      mixItems.push({
        mixId: mix.id,
        components: mix.components.map((component) => ({
          productId: String(component.product_id),
          productName: component.product_name,
          percentage: component.percentage,
          allocatedGrams: component.allocated_grams,
        })),
        bagSizeGrams: quoted.config.bagSizeGrams,
        fineness: mix.fineness,
        bagColourScheme: quoted.config.bagColourScheme,
        customLabel: mix.custom_label,
        priceVersion: quoted.priceVersion,
        unitPriceCents: quoted.unitPriceCents,
        quantity: mix.quantity,
        lineTotalCents: quoted.unitPriceCents * mix.quantity,
        usageLabel: derivePowderMixUsageLabel(products),
      });
    } catch {
      requotes.push({
        mixId: mix.id,
        oldUnitPriceCents: mix.quoted_unit_price_cents,
        newUnitPriceCents: mix.quoted_unit_price_cents,
      });
    }
  }

  if (requotes.length) return { success: false, error: 'MIX_REQUOTE_REQUIRED', mixes: requotes };
  const ids = [
    ...new Set(
      stockLines.flatMap((line) => line.allocations.map((allocation) => allocation.productId)),
    ),
  ];
  const products = ids
    .map((id) => dependencies.products.findById(id))
    .filter((product): product is NonNullable<typeof product> => product !== undefined)
    .map(toMixProduct);
  products.forEach((p) => resolveSourceVariant(p, dependencies.products.findVariantById));
  let requirements: readonly PowderMixStockRequirement[];
  try {
    requirements = calculatePowderMixStockRequirements(stockLines, products);
  } catch {
    return {
      success: false,
      error: 'MIX_REQUOTE_REQUIRED',
      mixes: persisted.map((mix) => ({
        mixId: mix.id,
        oldUnitPriceCents: mix.quoted_unit_price_cents,
        newUnitPriceCents: mix.quoted_unit_price_cents,
      })),
    };
  }
  return { requirements, mixItems };
}
