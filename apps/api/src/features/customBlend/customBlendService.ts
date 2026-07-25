import {
  CUSTOM_BLEND_FEE_CENTS,
  TIER_LADDER,
  type Cart,
  type CatalogVariant,
  type CreateCustomBlendBody,
  type CustomBlendOption,
  type CustomBlendOptionsResponse,
  type CustomBlendSnapshot,
  type ReplaceCustomBlendBody,
} from '@shop/contracts';
import { perTonneCents } from '../pricing/pricingRules.js';
import type { CustomBlendFactRow, CustomBlendRepository } from './customBlendRepository.js';
import type { CartService } from '../cart/cartService.js';
import type { AuditContext } from '../audit/auditEvent.js';
import { normalizeCustomBlendSpec } from './customBlendRules.js';

export class CustomBlendInvalidError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CustomBlendInvalidError';
  }
}

export interface CustomBlendService {
  listOptions(baseVariantId: number): CustomBlendOptionsResponse;
  create(
    carts: CartService,
    cartId: string,
    body: CreateCustomBlendBody,
    context: AuditContext,
  ): CustomBlendMutationResult;
  replace(
    carts: CartService,
    cartId: string,
    body: ReplaceCustomBlendBody,
    context: AuditContext,
  ): CustomBlendMutationResult;
}

export type CustomBlendMutationResult =
  | Cart
  | 'CART_NOT_FOUND'
  | 'VARIANT_NOT_FOUND'
  | 'VARIANT_NOT_IN_CART'
  | 'CART_RESERVED'
  | 'BELOW_MOQ'
  | 'INVALID_QUANTITY';

function toOption(row: CustomBlendFactRow): CustomBlendOption {
  const variant: CatalogVariant = {
    variantId: row.variant_id,
    productId: row.product_id,
    sku: row.sku,
    label: row.label,
    weightGrams: row.weight_grams,
    priceCents: row.price_cents,
    moqSacks: row.moq_sacks,
    perTonneCents: perTonneCents(row.price_cents, row.weight_grams),
    priceTiers: TIER_LADDER,
    ...(row.compare_at_price_cents === null
      ? {}
      : { compareAtPriceCents: row.compare_at_price_cents }),
    stockCount: row.stock_count,
    backorderable: row.backorderable === 1,
    backorderLeadDays: row.backorderable === 1 ? (row.backorder_lead_days ?? null) : null,
    deliveryClass: row.delivery_class as CatalogVariant['deliveryClass'],
    active: row.variant_active === 1,
    sortOrder: row.sort_order,
  };
  return {
    productId: String(row.product_id),
    productName: row.product_name,
    productDescription: row.product_description,
    mixingGroup: row.mixing_group,
    variant,
  };
}

/** Resolves options from current catalog facts; inventory availability intentionally does not filter lots. */
export function createCustomBlendService(repository: CustomBlendRepository): CustomBlendService {
  return {
    listOptions(baseVariantId) {
      const base = repository.findEligibleVariant(baseVariantId);
      if (!base) {
        throw new CustomBlendInvalidError('Selected base lot is not eligible for Custom Blend.');
      }
      return {
        base: toOption(base),
        ingredients: repository.listCompatibleIngredients(base).map(toOption),
      };
    },
    create(carts, cartId, body, context) {
      const snapshot = resolveSnapshot(repository, body.baseVariantId, body.ingredients);
      return carts.addConfigured(
        cartId,
        String(body.baseVariantId),
        snapshot,
        body.quantity,
        context,
      );
    },
    replace(carts, cartId, body, context) {
      const snapshot = resolveSnapshot(repository, body.baseVariantId, body.ingredients);
      return carts.replaceConfigured(
        cartId,
        String(body.baseVariantId),
        body.configKey,
        snapshot,
        context,
      );
    },
  };
}

/** Resolve every persisted fact at mutation time; stock remains deliberately irrelevant. */
function resolveSnapshot(
  repository: CustomBlendRepository,
  baseVariantId: number,
  ingredients: CreateCustomBlendBody['ingredients'],
): CustomBlendSnapshot {
  let normalized;
  try {
    normalized = normalizeCustomBlendSpec(baseVariantId, ingredients);
  } catch (error) {
    throw new CustomBlendInvalidError(
      error instanceof Error ? error.message : 'Custom Blend ingredients are invalid.',
    );
  }
  const base = repository.findEligibleVariant(baseVariantId);
  if (!base) throw new CustomBlendInvalidError('Selected base lot is not eligible for Custom Blend.');
  const compatibleByVariant = new Map(
    repository.listCompatibleIngredients(base).map((fact) => [fact.variant_id, fact]),
  );
  const snapshots = normalized.ingredients.map((ingredient) => {
    const fact = compatibleByVariant.get(ingredient.variantId);
    if (!fact) {
      throw new CustomBlendInvalidError('Selected ingredient lot is not compatible with this base lot.');
    }
    return {
      variantId: fact.variant_id,
      productId: String(fact.product_id),
      productName: fact.product_name,
      productDescription: fact.product_description,
      mixingGroup: fact.mixing_group as CustomBlendSnapshot['mixingGroup'],
      percentage: ingredient.percentage,
    };
  });
  return {
    configKey: normalized.configKey,
    basePercentage: normalized.basePercentage,
    mixingGroup: base.mixing_group as CustomBlendSnapshot['mixingGroup'],
    ingredients: snapshots,
    blendingFeeCents: CUSTOM_BLEND_FEE_CENTS,
    madeToOrder: true,
    returnable: false,
  };
}
