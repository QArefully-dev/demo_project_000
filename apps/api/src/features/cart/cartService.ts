import type { Cart, CartLineVariantSnap } from '@shop/contracts/cart';
import type { PowderMixCartItem } from '@shop/contracts/powderizer';
import { CATALOG_PRODUCTS } from '@shop/catalog';
import { toProductContract } from '../../mappers/product.js';
import type { CartLineRow, CartRepository } from './cartRepository.js';
import type { PowderMixRepository } from '../powderizer/powderMixRepository.js';
import { derivePowderMixUsageLabel } from '../powderizer/powderMixRules.js';
import type { UnitOfWork } from '../../db/unitOfWork.js';
import type { AuditContext } from '../audit/auditEvent.js';
import type { AuditWriter } from '../audit/auditService.js';
import type { InventoryService } from '../inventory/inventoryService.js';

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
    context?: AuditContext,
  ): Cart | 'CART_NOT_FOUND' | 'VARIANT_NOT_FOUND' | 'CART_RESERVED';
  update(
    cartId: string,
    variantId: string,
    quantity: number,
    context?: AuditContext,
  ): Cart | 'CART_NOT_FOUND' | 'VARIANT_NOT_IN_CART' | 'CART_RESERVED';
  remove(
    cartId: string,
    variantId: string,
    context?: AuditContext,
  ): Cart | 'CART_NOT_FOUND' | 'VARIANT_NOT_IN_CART' | 'CART_RESERVED';
}

export function createCartService(
  repository: CartRepository,
  mixes?: PowderMixRepository,
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
    get: (cartId) => getCart(repository, cartId, mixes, availabilityDependencies),
    add: (cartId, variantId, context) =>
      runCartMutation(auditDependencies, () => {
        requireAuditContext(auditDependencies, context);
        const result = addItem(repository, cartId, variantId, mixes, availabilityDependencies);
        if (context && auditDependencies && typeof result !== 'string') {
          auditDependencies.audit.append({
            action: 'cart.product_added',
            cartId,
            productId: Number(variantId),
            quantity:
              result.items.find((item) => item.variantSnap?.variantId === Number(variantId))
                ?.quantity ?? 1,
            context,
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
          mixes,
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
        const result = removeItem(repository, cartId, variantId, mixes, availabilityDependencies);
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

function toPowderMixCartItem(
  row: ReturnType<PowderMixRepository['listForCart']>[number],
): PowderMixCartItem {
  return {
    mixId: row.id,
    components: row.components.map((component) => ({
      productId: String(component.product_id),
      productName: component.product_name,
      percentage: component.percentage,
      allocatedGrams: component.allocated_grams,
    })),
    bagSizeGrams: row.bag_size_grams as PowderMixCartItem['bagSizeGrams'],
    fineness: row.fineness,
    bagColourScheme: row.bag_colour_scheme,
    customLabel: row.custom_label,
    priceVersion: row.price_version,
    unitPriceCents: row.quoted_unit_price_cents,
    quantity: row.quantity,
    lineTotalCents: row.quoted_unit_price_cents * row.quantity,
    usageLabel: derivePowderMixUsageLabel(
      row.components.map((component) => {
        const canonicalProduct = CATALOG_PRODUCTS.find(
          (product) => product.id === component.product_id,
        );
        const isNonFood = canonicalProduct?.baseFacts.consumptionClassification !== 'food';
        return {
          consumptionWarning: isNonFood ? ('Not for consumption' as const) : null,
        };
      }),
    ),
  };
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
    mixable: row.product_mixable,
    mix_unit_grams: row.product_mix_unit_grams,
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
  mixes?: PowderMixRepository,
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
    return {
      productId: String(row.product_id),
      product: toProductContract({
        ...productBase,
        available_to_sell: available,
        backorderable: variantBackorderable ? 1 : 0,
        backorder_lead_days: row.variant_backorder_lead_days,
      }),
      variantSnap: toVariantSnap(row),
      quantity: row.quantity,
      lineTotalCents: row.price_cents * row.quantity,
    };
  });
  const mixItems = mixes?.listForCart(cartId).map(toPowderMixCartItem) ?? [];
  return {
    id: cartId,
    items,
    mixItems,
    subtotalCents: [...items, ...mixItems].reduce((total, item) => total + item.lineTotalCents, 0),
    totalItems: [...items, ...mixItems].reduce((total, item) => total + item.quantity, 0),
  };
}

export function addItem(
  repository: CartRepository,
  cartId: string,
  variantId: string,
  mixes?: PowderMixRepository,
  availabilityDependencies?: CartAvailabilityDependencies,
): Cart | 'CART_NOT_FOUND' | 'VARIANT_NOT_FOUND' | 'CART_RESERVED' {
  if (!repository.exists(cartId)) return 'CART_NOT_FOUND';
  if (repository.isReserved(cartId, availabilityDependencies?.clock.now().toISOString()))
    return 'CART_RESERVED';
  if (!repository.variantExists(variantId)) return 'VARIANT_NOT_FOUND';
  repository.addLine(cartId, variantId);
  repository.touch(cartId);
  return getCart(repository, cartId, mixes, availabilityDependencies) ?? 'CART_NOT_FOUND';
}

export function updateItem(
  repository: CartRepository,
  cartId: string,
  variantId: string,
  quantity: number,
  mixes?: PowderMixRepository,
  availabilityDependencies?: CartAvailabilityDependencies,
): Cart | 'CART_NOT_FOUND' | 'VARIANT_NOT_IN_CART' | 'CART_RESERVED' {
  if (!repository.exists(cartId)) return 'CART_NOT_FOUND';
  if (repository.isReserved(cartId, availabilityDependencies?.clock.now().toISOString()))
    return 'CART_RESERVED';
  const changed =
    quantity === 0
      ? repository.removeLine(cartId, variantId)
      : repository.updateLine(cartId, variantId, quantity);
  if (!changed) return 'VARIANT_NOT_IN_CART';
  repository.touch(cartId);
  return getCart(repository, cartId, mixes, availabilityDependencies) ?? 'CART_NOT_FOUND';
}

export function removeItem(
  repository: CartRepository,
  cartId: string,
  variantId: string,
  mines?: PowderMixRepository,
  availabilityDependencies?: CartAvailabilityDependencies,
): Cart | 'CART_NOT_FOUND' | 'VARIANT_NOT_IN_CART' | 'CART_RESERVED' {
  if (!repository.exists(cartId)) return 'CART_NOT_FOUND';
  if (repository.isReserved(cartId, availabilityDependencies?.clock.now().toISOString()))
    return 'CART_RESERVED';
  if (!repository.removeLine(cartId, variantId)) return 'VARIANT_NOT_IN_CART';
  repository.touch(cartId);
  return getCart(repository, cartId, mines, availabilityDependencies) ?? 'CART_NOT_FOUND';
}
