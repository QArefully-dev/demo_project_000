import type { Cart, CartLineVariantSnap } from '@shop/contracts/cart';
import { SACK_WEIGHT_GRAMS } from '@shop/contracts/pricing';
import { toProductContract } from '../../mappers/product.js';
import type { CartLineRow, CartRepository } from './cartRepository.js';
import type { UnitOfWork } from '../../db/unitOfWork.js';
import type { AuditContext } from '../audit/auditEvent.js';
import type { AuditWriter } from '../audit/auditService.js';
import type { InventoryService } from '../inventory/inventoryService.js';
import { perTonneCents, resolveUnitPriceCents, validateMoq } from '../pricing/pricingRules.js';
import { quoteCartDelivery } from '../delivery/deliveryRules.js';

export interface CartAuditDependencies {
  unitOfWork: UnitOfWork;
  audit: AuditWriter;
}

export interface CartAvailabilityDependencies {
  inventory: Pick<InventoryService, 'availableToSell'>;
  clock: { now(): Date };
}

export interface CartService {
  create(context?: AuditContext): { cartId: string };
  get(cartId: string): Cart | undefined;
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
    update: (cartId, variantId, quantity, context) =>
      runCartMutation(auditDependencies, () => {
        requireAuditContext(auditDependencies, context);
        const result = updateItem(
          repository,
          cartId,
          variantId,
          quantity,
          availabilityDependencies,
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
    remove: (cartId, variantId, context) =>
      runCartMutation(auditDependencies, () => {
        requireAuditContext(auditDependencies, context);
        const result = removeItem(repository, cartId, variantId, availabilityDependencies);
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
  const availability = availabilityDependencies?.inventory.availableToSell(
    variantIds,
    availabilityDependencies.clock.now().toISOString(),
  );
  const availableByVariant = new Map(availability?.map((v) => [v.variantId, v.availableToSell]));
  const items = rows.map((row) => {
    const productBase = cartLineRowToProductBase(row);
    const available = availableByVariant.get(row.variant_id) ?? 0;
    const variantBackorderable = row.variant_backorderable === 1;
    const unitPriceCents = resolveUnitPriceCents(
      row.price_cents,
      row.quantity,
      row.variant_weight_grams,
    );
    return {
      productId: String(row.product_id),
      product: toProductContract({
        ...productBase,
        available_to_sell: available,
        backorderable: variantBackorderable ? 1 : 0,
        backorder_lead_days: row.variant_backorder_lead_days,
      }),
      variantSnap: toVariantSnap(row),
      perTonneCents: perTonneCents(row.price_cents, row.variant_weight_grams),
      resolvedUnitPriceCents: unitPriceCents,
      quantity: row.quantity,
      lineTotalCents: unitPriceCents * row.quantity,
    };
  });
  return {
    id: cartId,
    items,
    subtotalCents: items.reduce((total, item) => total + item.lineTotalCents, 0),
    totalItems: items.reduce((total, item) => total + item.quantity, 0),
    deliveryPreview: quoteCartDelivery({ items }),
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

function minimumMoqQuantity(weightGrams: number, moqSacks: number): number | undefined {
  if (
    !Number.isSafeInteger(weightGrams) ||
    weightGrams < 1 ||
    !Number.isSafeInteger(moqSacks) ||
    moqSacks < 1 ||
    moqSacks > Math.floor(Number.MAX_SAFE_INTEGER / SACK_WEIGHT_GRAMS)
  ) {
    return undefined;
  }
  const quantity = Math.ceil((moqSacks * SACK_WEIGHT_GRAMS) / weightGrams);
  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    return undefined;
  }
  return quantity;
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
):
  | Cart
  | 'CART_NOT_FOUND'
  | 'VARIANT_NOT_IN_CART'
  | 'CART_RESERVED'
  | 'BELOW_MOQ'
  | 'INVALID_QUANTITY' {
  if (!repository.exists(cartId)) return 'CART_NOT_FOUND';
  if (repository.isReserved(cartId, availabilityDependencies?.clock.now().toISOString()))
    return 'CART_RESERVED';
  if (quantity !== 0) {
    if (repository.lineQuantity(cartId, variantId) === 0) return 'VARIANT_NOT_IN_CART';
    const variant = repository.getVariant(Number(variantId));
    if (!variant) return 'VARIANT_NOT_IN_CART';
    if (!supportsCartLineArithmetic(variant, quantity)) return 'INVALID_QUANTITY';
    if (!validateMoq(quantity, variant.weight_grams, variant.moq_sacks)) return 'BELOW_MOQ';
  }
  const changed =
    quantity === 0
      ? repository.removeLine(cartId, variantId)
      : repository.updateLine(cartId, variantId, quantity);
  if (!changed) return 'VARIANT_NOT_IN_CART';
  repository.touch(cartId);
  return getCart(repository, cartId, availabilityDependencies) ?? 'CART_NOT_FOUND';
}

export function removeItem(
  repository: CartRepository,
  cartId: string,
  variantId: string,
  availabilityDependencies?: CartAvailabilityDependencies,
): Cart | 'CART_NOT_FOUND' | 'VARIANT_NOT_IN_CART' | 'CART_RESERVED' {
  if (!repository.exists(cartId)) return 'CART_NOT_FOUND';
  if (repository.isReserved(cartId, availabilityDependencies?.clock.now().toISOString()))
    return 'CART_RESERVED';
  if (!repository.removeLine(cartId, variantId)) return 'VARIANT_NOT_IN_CART';
  repository.touch(cartId);
  return getCart(repository, cartId, availabilityDependencies) ?? 'CART_NOT_FOUND';
}
