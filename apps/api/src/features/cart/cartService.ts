import type { Cart, CartLineVariantSnap } from '@shop/contracts/cart';
import {
  CUSTOM_BLEND_FEE_CENTS,
  CustomBlendSnapshot as CustomBlendSnapshotSchema,
  type CustomBlendSnapshot,
} from '@shop/contracts';
import { Value } from '@sinclair/typebox/value';
import { toProductContract } from '../../mappers/product.js';
import type { CartLineRow, CartRepository } from './cartRepository.js';
import type { UnitOfWork } from '../../db/unitOfWork.js';
import type { AuditContext } from '../audit/auditEvent.js';
import type { AuditWriter } from '../audit/auditService.js';
import type { InventoryService } from '../inventory/inventoryService.js';
import {
  minimumOrderQuantity,
  nextTierProgress,
  perTonneCents,
  resolveUnitPriceCents,
  validateMoq,
} from '../pricing/pricingRules.js';
import { resolveClearance } from '../pricing/clearanceRules.js';
import { quoteCartDelivery } from '../delivery/deliveryRules.js';
import {
  calculateCustomBlendLinePricing,
  normalizeCustomBlendSpec,
} from '../customBlend/customBlendRules.js';
import {
  aggregateBulkAddDemand,
  classifyBulkAddGroup,
  fanOutBulkAddOutcome,
  type BulkAddGroup,
  type BulkAddOutcome,
  type BulkAddRequest,
} from './cartBulkAddRules.js';

export interface CartAuditDependencies {
  unitOfWork: UnitOfWork;
  audit: AuditWriter;
}

export interface CartAvailabilityDependencies {
  inventory: Pick<InventoryService, 'availableToSell'>;
  clock: { now(): Date };
}

/** Whole-request rejection codes for a bulk add; per-line problems are outcomes, not errors. */
export type BulkAddRejection = 'CART_NOT_FOUND' | 'CART_RESERVED';

export interface BulkAddResult {
  cart: Cart;
  /** One outcome per submitted request, in submission order. */
  outcomes: BulkAddOutcome[];
}

export interface CartService {
  create(context?: AuditContext): { cartId: string };
  get(cartId: string): Cart | undefined;
  /**
   * Adds many lines in one transaction with per-line outcomes. Classified skips still commit the
   * lines that succeeded; only an unexpected throw rolls the whole mutation back.
   */
  addMany(
    cartId: string,
    requests: readonly BulkAddRequest[],
    context?: AuditContext,
  ): BulkAddResult | BulkAddRejection;
  add(
    cartId: string,
    variantId: string,
    quantityOrContext?: number | AuditContext,
    context?: AuditContext,
  ):
    | Cart
    | 'CART_NOT_FOUND'
    | 'VARIANT_NOT_FOUND'
    | 'CART_RESERVED'
    | 'BELOW_MOQ'
    | 'INVALID_QUANTITY';
  update(
    cartId: string,
    variantId: string,
    quantity: number,
    context?: AuditContext,
    configKey?: string,
  ):
    | Cart
    | 'CART_NOT_FOUND'
    | 'VARIANT_NOT_IN_CART'
    | 'CART_RESERVED'
    | 'BELOW_MOQ'
    | 'INVALID_QUANTITY';
  remove(
    cartId: string,
    variantId: string,
    context?: AuditContext,
    configKey?: string,
  ): Cart | 'CART_NOT_FOUND' | 'VARIANT_NOT_IN_CART' | 'CART_RESERVED';
  addConfigured(
    cartId: string,
    variantId: string,
    customBlend: CustomBlendSnapshot,
    quantity: number | undefined,
    context?: AuditContext,
  ):
    | Cart
    | 'CART_NOT_FOUND'
    | 'VARIANT_NOT_FOUND'
    | 'CART_RESERVED'
    | 'BELOW_MOQ'
    | 'INVALID_QUANTITY';
  replaceConfigured(
    cartId: string,
    variantId: string,
    previousConfigKey: string,
    customBlend: CustomBlendSnapshot,
    context?: AuditContext,
  ): Cart | 'CART_NOT_FOUND' | 'VARIANT_NOT_IN_CART' | 'CART_RESERVED';
}

export function createCartService(
  repository: CartRepository,
  auditDependencies?: CartAuditDependencies,
  availabilityDependencies?: CartAvailabilityDependencies,
): CartService {
  return {
    create: (context) =>
      runCartMutation(auditDependencies, () => {
        requireAuditContext(auditDependencies, context);
        const result = createCart(repository);
        if (context && auditDependencies) {
          auditDependencies.audit.append({
            action: 'cart.created',
            cartId: result.cartId,
            context,
          });
        }
        return result;
      }),
    get: (cartId) => getCart(repository, cartId, availabilityDependencies),
    addMany: (cartId, requests, context) => {
      if (!auditDependencies) throw new Error('Cart audit dependencies are required for bulk add');
      if (!availabilityDependencies) {
        throw new Error('Cart availability dependencies are required for bulk add');
      }
      return runCartMutation(auditDependencies, () => {
        requireAuditContext(auditDependencies, context);
        return addManyItems(
          repository,
          cartId,
          requests,
          availabilityDependencies,
          auditDependencies,
          context!,
        );
      });
    },
    add: (cartId, variantId, quantityOrContext, context) =>
      runCartMutation(auditDependencies, () => {
        const quantity = typeof quantityOrContext === 'number' ? quantityOrContext : undefined;
        const auditContext = typeof quantityOrContext === 'number' ? context : quantityOrContext;
        requireAuditContext(auditDependencies, auditContext);
        const result = addItem(repository, cartId, variantId, quantity, availabilityDependencies);
        if (auditContext && auditDependencies && typeof result !== 'string') {
          auditDependencies.audit.append({
            action: 'cart.product_added',
            cartId,
            productId: Number(variantId),
            quantity:
              result.items.find((item) => item.variantSnap?.variantId === Number(variantId))
                ?.quantity ?? 1,
            context: auditContext,
          });
        }
        return result;
      }),
    update: (cartId, variantId, quantity, context, configKey = '') =>
      runCartMutation(auditDependencies, () => {
        requireAuditContext(auditDependencies, context);
        const result = updateItem(
          repository,
          cartId,
          variantId,
          quantity,
          availabilityDependencies,
          configKey,
        );
        if (context && auditDependencies && typeof result !== 'string') {
          auditDependencies.audit.append(
            quantity === 0
              ? {
                  action: 'cart.product_removed',
                  cartId,
                  productId: Number(variantId),
                  context,
                }
              : {
                  action: 'cart.product_quantity_changed',
                  cartId,
                  productId: Number(variantId),
                  quantity,
                  context,
                },
          );
        }
        return result;
      }),
    remove: (cartId, variantId, context, configKey = '') =>
      runCartMutation(auditDependencies, () => {
        requireAuditContext(auditDependencies, context);
        const result = removeItem(
          repository,
          cartId,
          variantId,
          availabilityDependencies,
          configKey,
        );
        if (context && auditDependencies && typeof result !== 'string') {
          auditDependencies.audit.append({
            action: 'cart.product_removed',
            cartId,
            productId: Number(variantId),
            context,
          });
        }
        return result;
      }),
    addConfigured: (cartId, variantId, customBlend, quantity, context) =>
      runCartMutation(auditDependencies, () => {
        requireAuditContext(auditDependencies, context);
        const result = addConfiguredItem(
          repository,
          cartId,
          variantId,
          customBlend,
          quantity,
          availabilityDependencies,
        );
        if (context && auditDependencies && typeof result !== 'string') {
          auditDependencies.audit.append({
            action: 'cart.product_added',
            cartId,
            productId: Number(variantId),
            quantity:
              result.items.find(
                (item) =>
                  item.variantSnap?.variantId === Number(variantId) &&
                  item.configKey === customBlend.configKey,
              )?.quantity ?? 1,
            context,
          });
        }
        return result;
      }),
    replaceConfigured: (cartId, variantId, previousConfigKey, customBlend, context) =>
      runCartMutation(auditDependencies, () => {
        requireAuditContext(auditDependencies, context);
        const result = replaceConfiguredItem(
          repository,
          cartId,
          variantId,
          previousConfigKey,
          customBlend,
          availabilityDependencies,
        );
        if (context && auditDependencies && typeof result !== 'string') {
          const changed = result.items.find(
            (item) =>
              item.variantSnap?.variantId === Number(variantId) &&
              item.configKey === customBlend.configKey,
          );
          if (changed) {
            auditDependencies.audit.append({
              action: 'cart.product_quantity_changed',
              cartId,
              productId: Number(variantId),
              quantity: changed.quantity,
              context,
            });
          }
        }
        return result;
      }),
  };
}

function runCartMutation<T>(dependencies: CartAuditDependencies | undefined, work: () => T): T {
  return dependencies ? dependencies.unitOfWork.run(work) : work();
}

function requireAuditContext(
  dependencies: CartAuditDependencies | undefined,
  context: AuditContext | undefined,
): void {
  if (dependencies && !context) throw new Error('Cart audit context is required');
}

export function createCart(repository: CartRepository): { cartId: string } {
  const cartId = crypto.randomUUID();
  repository.create(cartId);
  return { cartId };
}

function cartLineRowToProductBase(row: CartLineRow) {
  return {
    id: row.product_id,
    name: row.product_name,
    description: row.product_description,
    price_cents: row.price_cents,
    category: row.product_category,
    stock_count: 0,
    image_set_id: row.product_image_set_id,
    slug: row.product_slug,
    compare_at_price_cents: row.product_compare_at_price_cents,
    sales_count: row.product_sales_count,
    active: row.product_active,
    created_at: row.product_created_at,
    consumption_classification: row.product_consumption_classification,
    mixing_group: null,
    details_json: null,
    default_variant_id: row.product_default_variant_id,
    blend_source_variant_id: row.product_blend_source_variant_id,
  };
}

function toVariantSnap(row: CartLineRow): CartLineVariantSnap {
  return {
    variantId: row.variant_id,
    sku: row.variant_sku,
    label: row.variant_label,
    weightGrams: row.variant_weight_grams,
    deliveryClass: row.variant_delivery_class as CartLineVariantSnap['deliveryClass'],
  };
}

export function getCart(
  repository: CartRepository,
  cartId: string,
  availabilityDependencies?: CartAvailabilityDependencies,
): Cart | undefined {
  if (!repository.exists(cartId)) return undefined;
  const rows = repository.listLines(cartId);
  const variantIds = rows.map((row) => row.variant_id);
  const now = availabilityDependencies?.clock.now();
  const availability = availabilityDependencies
    ? availabilityDependencies.inventory.availableToSell(variantIds, now!.toISOString())
    : undefined;
  const availableByVariant = new Map(availability?.map((v) => [v.variantId, v.availableToSell]));
  const customBlends = new Map<number, CustomBlendSnapshot>();
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]!;
    if (row.config_key === '') {
      if (row.custom_blend_json !== null) return undefined;
      continue;
    }
    const customBlend = hydrateCustomBlend(repository, row);
    if (!customBlend) return undefined;
    customBlends.set(index, customBlend);
  }
  const items = rows.map((row, index) => {
    const productBase = cartLineRowToProductBase(row);
    const available = availableByVariant.get(row.variant_id) ?? 0;
    const variantBackorderable = row.variant_backorderable === 1;
    const clearanceResolution = now
      ? resolveClearance({
          priceCents: row.price_cents,
          clearancePriceCents: row.variant_clearance_price_cents ?? null,
          clearanceStartsAt: row.variant_clearance_starts_at ?? null,
          clearanceEndsAt: row.variant_clearance_ends_at ?? null,
          weightGrams: row.variant_weight_grams,
          now,
        })
      : { basePriceCents: row.price_cents, clearance: null };
    const resolvedBasePriceCents =
      clearanceResolution.clearance?.priceCents ?? clearanceResolution.basePriceCents;
    const unitPriceCents = resolveUnitPriceCents(
      resolvedBasePriceCents,
      row.quantity,
      row.variant_weight_grams,
    );
    const customBlend = customBlends.get(index);
    const pricing = customBlend
      ? calculateCustomBlendLinePricing(unitPriceCents, row.quantity, customBlend.blendingFeeCents)
      : {
          materialSubtotalCents: unitPriceCents * row.quantity,
          blendingFeeCents: 0,
          discountableTotalCents: unitPriceCents * row.quantity,
          lineTotalCents: unitPriceCents * row.quantity,
        };
    const tierProgress = nextTierProgress(row.quantity, row.variant_weight_grams);
    return {
      productId: String(row.product_id),
      configKey: row.config_key,
      product: toProductContract({
        ...productBase,
        available_to_sell: available,
        backorderable: variantBackorderable ? 1 : 0,
        backorder_lead_days: row.variant_backorder_lead_days,
      }),
      variantSnap: toVariantSnap(row),
      perTonneCents: perTonneCents(resolvedBasePriceCents, row.variant_weight_grams),
      resolvedUnitPriceCents: unitPriceCents,
      ...(tierProgress ? { nextTierProgress: tierProgress } : {}),
      ...(clearanceResolution.clearance ? { clearance: clearanceResolution.clearance } : {}),
      quantity: row.quantity,
      ...pricing,
      ...(customBlend ? { customBlend } : {}),
    };
  });
  return {
    id: cartId,
    items,
    subtotalCents: items.reduce((total, item) => total + item.lineTotalCents, 0),
    discountableSubtotalCents: items.reduce(
      (total, item) => total + item.discountableTotalCents,
      0,
    ),
    blendingFeeTotalCents: items.reduce((total, item) => total + item.blendingFeeCents, 0),
    totalItems: items.reduce((total, item) => total + item.quantity, 0),
    deliveryPreview: quoteCartDelivery({ items }),
  };
}

/** Corrupt or retired configured facts invalidate the complete cart before any payment path. */
function hydrateCustomBlend(
  repository: CartRepository,
  row: CartLineRow,
): CustomBlendSnapshot | undefined {
  if (!row.custom_blend_json) return undefined;
  let persisted: CustomBlendSnapshot;
  try {
    persisted = Value.Parse(CustomBlendSnapshotSchema, JSON.parse(row.custom_blend_json));
  } catch {
    return undefined;
  }
  if (
    persisted.configKey !== row.config_key ||
    persisted.blendingFeeCents !== CUSTOM_BLEND_FEE_CENTS
  ) {
    return undefined;
  }
  let normalized;
  try {
    normalized = normalizeCustomBlendSpec(row.variant_id, persisted.ingredients);
  } catch {
    return undefined;
  }
  if (
    normalized.configKey !== row.config_key ||
    normalized.basePercentage !== persisted.basePercentage
  ) {
    return undefined;
  }
  const factIds = [
    row.variant_id,
    ...normalized.ingredients.map((ingredient) => ingredient.variantId),
  ];
  const facts = repository.listEligibleCustomBlendFacts(factIds);
  if (facts.length !== factIds.length) return undefined;
  const byVariantId = new Map(facts.map((fact) => [fact.variant_id, fact]));
  const base = byVariantId.get(row.variant_id);
  if (!base || base.mixing_group !== persisted.mixingGroup) return undefined;
  const ingredients = normalized.ingredients.map((ingredient) => {
    const fact = byVariantId.get(ingredient.variantId);
    if (!fact || fact.variant_id === base.variant_id || fact.mixing_group !== base.mixing_group)
      return undefined;
    return {
      variantId: fact.variant_id,
      productId: String(fact.product_id),
      productName: fact.product_name,
      productDescription: fact.product_description,
      mixingGroup: fact.mixing_group,
      percentage: ingredient.percentage,
    };
  });
  if (ingredients.some((ingredient) => ingredient === undefined)) return undefined;
  return {
    configKey: normalized.configKey,
    basePercentage: normalized.basePercentage,
    mixingGroup: base.mixing_group,
    ...(persisted.basePresentation ? { basePresentation: persisted.basePresentation } : {}),
    ingredients: ingredients as CustomBlendSnapshot['ingredients'],
    blendingFeeCents: CUSTOM_BLEND_FEE_CENTS,
    madeToOrder: true,
    returnable: false,
  };
}

export function addItem(
  repository: CartRepository,
  cartId: string,
  variantId: string,
  quantity?: number,
  availabilityDependencies?: CartAvailabilityDependencies,
):
  | Cart
  | 'CART_NOT_FOUND'
  | 'VARIANT_NOT_FOUND'
  | 'CART_RESERVED'
  | 'BELOW_MOQ'
  | 'INVALID_QUANTITY' {
  if (!repository.exists(cartId)) return 'CART_NOT_FOUND';
  if (!getCart(repository, cartId, availabilityDependencies)) return 'CART_NOT_FOUND';
  if (repository.isReserved(cartId, availabilityDependencies?.clock.now().toISOString()))
    return 'CART_RESERVED';
  if (!repository.variantExists(variantId)) return 'VARIANT_NOT_FOUND';
  const variant = repository.getVariant(Number(variantId));
  if (!variant) return 'VARIANT_NOT_FOUND';
  const addedQuantity = quantity ?? minimumMoqQuantity(variant.weight_grams, variant.moq_sacks);
  if (addedQuantity === undefined) return 'INVALID_QUANTITY';
  const nextQuantity = repository.lineQuantity(cartId, variantId) + addedQuantity;
  if (!supportsCartLineArithmetic(variant, nextQuantity)) return 'INVALID_QUANTITY';
  if (!validateMoq(nextQuantity, variant.weight_grams, variant.moq_sacks)) {
    return 'BELOW_MOQ';
  }
  repository.addLineQuantity(cartId, variantId, addedQuantity);
  repository.touch(cartId);
  return getCart(repository, cartId, availabilityDependencies) ?? 'CART_NOT_FOUND';
}

export function addConfiguredItem(
  repository: CartRepository,
  cartId: string,
  variantId: string,
  customBlend: CustomBlendSnapshot,
  quantity: number | undefined,
  availabilityDependencies?: CartAvailabilityDependencies,
):
  | Cart
  | 'CART_NOT_FOUND'
  | 'VARIANT_NOT_FOUND'
  | 'CART_RESERVED'
  | 'BELOW_MOQ'
  | 'INVALID_QUANTITY' {
  if (!repository.exists(cartId)) return 'CART_NOT_FOUND';
  if (!getCart(repository, cartId, availabilityDependencies)) return 'CART_NOT_FOUND';
  if (repository.isReserved(cartId, availabilityDependencies?.clock.now().toISOString())) {
    return 'CART_RESERVED';
  }
  const variant = repository.getVariant(Number(variantId));
  if (!variant || !repository.variantExists(variantId)) return 'VARIANT_NOT_FOUND';
  const addedQuantity = quantity ?? minimumMoqQuantity(variant.weight_grams, variant.moq_sacks);
  if (addedQuantity === undefined) return 'INVALID_QUANTITY';
  const nextQuantity =
    repository.lineQuantity(cartId, variantId, customBlend.configKey) + addedQuantity;
  if (!supportsCartLineArithmetic(variant, nextQuantity)) return 'INVALID_QUANTITY';
  if (!validateMoq(nextQuantity, variant.weight_grams, variant.moq_sacks)) return 'BELOW_MOQ';
  repository.addConfiguredLineQuantity(
    cartId,
    variantId,
    customBlend.configKey,
    JSON.stringify(customBlend),
    addedQuantity,
  );
  repository.touch(cartId);
  return getCart(repository, cartId, availabilityDependencies) ?? 'CART_NOT_FOUND';
}

/**
 * Re-derives a configured blend from live facts instead of trusting the caller snapshot: the spec
 * is re-normalized, re-hashed, and matched against the supplied `configKey`, ingredient facts are
 * re-read, and the blending fee is always the current constant. Returns `undefined` when the blend
 * can no longer be sold, which the classifier reports as `BLEND_UNAVAILABLE`.
 */
function resolveBulkAddBlend(
  repository: CartRepository,
  variantId: number,
  supplied: CustomBlendSnapshot,
): CustomBlendSnapshot | undefined {
  let normalized;
  try {
    normalized = normalizeCustomBlendSpec(variantId, supplied.ingredients);
  } catch {
    return undefined;
  }
  if (normalized.configKey !== supplied.configKey) return undefined;
  const factIds = [variantId, ...normalized.ingredients.map((ingredient) => ingredient.variantId)];
  const facts = repository.listEligibleCustomBlendFacts(factIds);
  if (facts.length !== factIds.length) return undefined;
  const byVariantId = new Map(facts.map((fact) => [fact.variant_id, fact]));
  const base = byVariantId.get(variantId);
  if (!base) return undefined;
  const ingredients: CustomBlendSnapshot['ingredients'] = [];
  for (const ingredient of normalized.ingredients) {
    const fact = byVariantId.get(ingredient.variantId);
    if (!fact || fact.variant_id === base.variant_id || fact.mixing_group !== base.mixing_group) {
      return undefined;
    }
    ingredients.push({
      variantId: fact.variant_id,
      productId: String(fact.product_id),
      productName: fact.product_name,
      productDescription: fact.product_description,
      mixingGroup: fact.mixing_group,
      percentage: ingredient.percentage,
    });
  }
  return {
    configKey: normalized.configKey,
    basePercentage: normalized.basePercentage,
    mixingGroup: base.mixing_group,
    ...(supplied.basePresentation ? { basePresentation: supplied.basePresentation } : {}),
    ingredients,
    blendingFeeCents: CUSTOM_BLEND_FEE_CENTS,
    madeToOrder: true,
    returnable: false,
  };
}

/**
 * Adds many lines at once. Ordinary and configured lines share one stock pre-flight, one cart
 * touch, and one transaction; a line that fails classification is skipped without disturbing the
 * rest. Each line is added at its full ordered quantity or not at all.
 */
export function addManyItems(
  repository: CartRepository,
  cartId: string,
  requests: readonly BulkAddRequest[],
  availabilityDependencies: CartAvailabilityDependencies,
  auditDependencies: CartAuditDependencies,
  context: AuditContext,
): BulkAddResult | BulkAddRejection {
  if (!repository.exists(cartId)) return 'CART_NOT_FOUND';
  if (!getCart(repository, cartId, availabilityDependencies)) return 'CART_NOT_FOUND';
  const now = availabilityDependencies.clock.now();
  if (repository.isReserved(cartId, now.toISOString())) return 'CART_RESERVED';

  const groups = aggregateBulkAddDemand(requests);
  const variantIds = [...new Set(groups.map((group) => group.variantId))];
  const availability = new Map(
    availabilityDependencies.inventory
      .availableToSell(variantIds, now.toISOString())
      .map((row) => [row.variantId, row]),
  );

  const outcomeByIdentity = new Map<string, BulkAddOutcome[]>();
  const applied: Array<{
    group: BulkAddGroup;
    blend: CustomBlendSnapshot | undefined;
    resultingQuantity: number;
  }> = [];
  for (const group of groups) {
    const variant = repository.variantExists(String(group.variantId))
      ? repository.getVariant(group.variantId)
      : undefined;
    const blend = group.customBlend
      ? resolveBulkAddBlend(repository, group.variantId, group.customBlend)
      : undefined;
    const availabilityRow = availability.get(group.variantId);
    const classification = classifyBulkAddGroup({
      variantRow: variant,
      existingQuantity: repository.lineQuantity(cartId, String(group.variantId), group.configKey),
      requestedQuantity: group.requestedQuantity,
      availability: availabilityRow
        ? {
            availableToSell: availabilityRow.availableToSell,
            backorderable: availabilityRow.backorderable,
          }
        : undefined,
      ...(group.customBlend ? { blendValid: blend !== undefined } : {}),
      now,
    });
    outcomeByIdentity.set(
      `${group.variantId} ${group.configKey}`,
      fanOutBulkAddOutcome(group, classification),
    );
    if (classification.status === 'added') {
      applied.push({ group, blend, resultingQuantity: classification.resultingQuantity });
    }
  }

  for (const { group, blend } of applied) {
    if (blend) {
      repository.addConfiguredLineQuantity(
        cartId,
        String(group.variantId),
        blend.configKey,
        JSON.stringify(blend),
        group.requestedQuantity,
      );
    } else {
      repository.addLineQuantity(cartId, String(group.variantId), group.requestedQuantity);
    }
  }
  if (applied.length > 0) {
    repository.touch(cartId);
    for (const { group, resultingQuantity } of applied) {
      auditDependencies.audit.append({
        action: 'cart.product_added',
        cartId,
        productId: group.variantId,
        // `cart.product_added` metadata carries the post-add cumulative line quantity, matching
        // the single-line `add`/`addConfigured` emitters — not the delta this request contributed.
        quantity: resultingQuantity,
        context,
      });
    }
  }

  const cart = getCart(repository, cartId, availabilityDependencies);
  if (!cart) return 'CART_NOT_FOUND';
  const cursorByIdentity = new Map<string, number>();
  const outcomes = requests.map((request) => {
    const identity = `${request.variantId} ${request.customBlend?.configKey ?? ''}`;
    const cursor = cursorByIdentity.get(identity) ?? 0;
    cursorByIdentity.set(identity, cursor + 1);
    const outcome = outcomeByIdentity.get(identity)?.[cursor];
    if (!outcome) throw new Error('Bulk add outcome is missing for a submitted request');
    return outcome;
  });
  return { cart, outcomes };
}

function minimumMoqQuantity(weightGrams: number, moqSacks: number): number | undefined {
  return minimumOrderQuantity(weightGrams, moqSacks);
}

function supportsCartLineArithmetic(
  variant: { weight_grams: number; price_cents: number },
  quantity: number,
): boolean {
  if (
    !Number.isSafeInteger(quantity) ||
    quantity < 1 ||
    !Number.isSafeInteger(variant.weight_grams) ||
    variant.weight_grams < 1 ||
    !Number.isSafeInteger(variant.price_cents) ||
    variant.price_cents < 0 ||
    quantity > Math.floor(Number.MAX_SAFE_INTEGER / variant.weight_grams) ||
    variant.price_cents > Math.floor(Number.MAX_SAFE_INTEGER / 100) ||
    (variant.price_cents > 0 &&
      quantity > Math.floor(Number.MAX_SAFE_INTEGER / variant.price_cents))
  ) {
    return false;
  }
  return true;
}

export function updateItem(
  repository: CartRepository,
  cartId: string,
  variantId: string,
  quantity: number,
  availabilityDependencies?: CartAvailabilityDependencies,
  configKey = '',
):
  | Cart
  | 'CART_NOT_FOUND'
  | 'VARIANT_NOT_IN_CART'
  | 'CART_RESERVED'
  | 'BELOW_MOQ'
  | 'INVALID_QUANTITY' {
  if (!repository.exists(cartId)) return 'CART_NOT_FOUND';
  if (!getCart(repository, cartId, availabilityDependencies)) return 'CART_NOT_FOUND';
  if (repository.isReserved(cartId, availabilityDependencies?.clock.now().toISOString()))
    return 'CART_RESERVED';
  if (quantity !== 0) {
    if (repository.lineQuantity(cartId, variantId, configKey) === 0) return 'VARIANT_NOT_IN_CART';
    const variant = repository.getVariant(Number(variantId));
    if (!variant) return 'VARIANT_NOT_IN_CART';
    if (!supportsCartLineArithmetic(variant, quantity)) return 'INVALID_QUANTITY';
    if (!validateMoq(quantity, variant.weight_grams, variant.moq_sacks)) return 'BELOW_MOQ';
  }
  const changed =
    quantity === 0
      ? repository.removeLine(cartId, variantId, configKey)
      : repository.updateLine(cartId, variantId, quantity, configKey);
  if (!changed) return 'VARIANT_NOT_IN_CART';
  repository.touch(cartId);
  return getCart(repository, cartId, availabilityDependencies) ?? 'CART_NOT_FOUND';
}

export function removeItem(
  repository: CartRepository,
  cartId: string,
  variantId: string,
  availabilityDependencies?: CartAvailabilityDependencies,
  configKey = '',
): Cart | 'CART_NOT_FOUND' | 'VARIANT_NOT_IN_CART' | 'CART_RESERVED' {
  if (!repository.exists(cartId)) return 'CART_NOT_FOUND';
  if (!getCart(repository, cartId, availabilityDependencies)) return 'CART_NOT_FOUND';
  if (repository.isReserved(cartId, availabilityDependencies?.clock.now().toISOString()))
    return 'CART_RESERVED';
  if (!repository.removeLine(cartId, variantId, configKey)) return 'VARIANT_NOT_IN_CART';
  repository.touch(cartId);
  return getCart(repository, cartId, availabilityDependencies) ?? 'CART_NOT_FOUND';
}

export function replaceConfiguredItem(
  repository: CartRepository,
  cartId: string,
  variantId: string,
  previousConfigKey: string,
  customBlend: CustomBlendSnapshot,
  availabilityDependencies?: CartAvailabilityDependencies,
): Cart | 'CART_NOT_FOUND' | 'VARIANT_NOT_IN_CART' | 'CART_RESERVED' {
  if (!repository.exists(cartId)) return 'CART_NOT_FOUND';
  if (!getCart(repository, cartId, availabilityDependencies)) return 'CART_NOT_FOUND';
  if (repository.isReserved(cartId, availabilityDependencies?.clock.now().toISOString())) {
    return 'CART_RESERVED';
  }
  const changed = repository.replaceConfiguredLine(
    cartId,
    variantId,
    previousConfigKey,
    customBlend.configKey,
    JSON.stringify(customBlend),
  );
  if (!changed) return 'VARIANT_NOT_IN_CART';
  repository.touch(cartId);
  return getCart(repository, cartId, availabilityDependencies) ?? 'CART_NOT_FOUND';
}
