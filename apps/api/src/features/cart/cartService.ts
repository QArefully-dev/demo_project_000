import type { Cart } from '@shop/contracts/cart';
import type { PowderMixCartItem } from '@shop/contracts/powderizer';
import { CATALOG_PRODUCTS } from '@shop/catalog';
import { toProductContract } from '../../mappers/product.js';
import type { CartRepository } from './cartRepository.js';
import type { PowderMixRepository } from '../powderizer/powderMixRepository.js';
import { derivePowderMixUsageLabel } from '../powderizer/powderMixRules.js';
import type { UnitOfWork } from '../../db/unitOfWork.js';
import type { AuditContext } from '../audit/auditEvent.js';
import type { AuditWriter } from '../audit/auditService.js';

export interface CartAuditDependencies {
  unitOfWork: UnitOfWork;
  audit: AuditWriter;
}

export interface CartService {
  create(context?: AuditContext): { cartId: string };
  get(cartId: string): Cart | undefined;
  add(
    cartId: string,
    productId: string,
    context?: AuditContext,
  ): Cart | 'CART_NOT_FOUND' | 'PRODUCT_NOT_FOUND' | 'CART_RESERVED';
  update(
    cartId: string,
    productId: string,
    quantity: number,
    context?: AuditContext,
  ): Cart | 'CART_NOT_FOUND' | 'PRODUCT_NOT_IN_CART' | 'CART_RESERVED';
  remove(
    cartId: string,
    productId: string,
    context?: AuditContext,
  ): Cart | 'CART_NOT_FOUND' | 'PRODUCT_NOT_IN_CART' | 'CART_RESERVED';
}

export function createCartService(
  repository: CartRepository,
  mixes?: PowderMixRepository,
  auditDependencies?: CartAuditDependencies,
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
    get: (cartId) => getCart(repository, cartId, mixes),
    add: (cartId, productId, context) =>
      runCartMutation(auditDependencies, () => {
        requireAuditContext(auditDependencies, context);
        const result = addItem(repository, cartId, productId, mixes);
        if (context && auditDependencies && typeof result !== 'string') {
          auditDependencies.audit.append({
            action: 'cart.product_added',
            cartId,
            productId: Number(productId),
            quantity:
              result.items.find((item) => item.productId === String(Number(productId)))?.quantity ??
              1,
            context,
          });
        }
        return result;
      }),
    update: (cartId, productId, quantity, context) =>
      runCartMutation(auditDependencies, () => {
        requireAuditContext(auditDependencies, context);
        const result = updateItem(repository, cartId, productId, quantity, mixes);
        if (context && auditDependencies && typeof result !== 'string') {
          auditDependencies.audit.append(
            quantity === 0
              ? { action: 'cart.product_removed', cartId, productId: Number(productId), context }
              : {
                  action: 'cart.product_quantity_changed',
                  cartId,
                  productId: Number(productId),
                  quantity,
                  context,
                },
          );
        }
        return result;
      }),
    remove: (cartId, productId, context) =>
      runCartMutation(auditDependencies, () => {
        requireAuditContext(auditDependencies, context);
        const result = removeItem(repository, cartId, productId, mixes);
        if (context && auditDependencies && typeof result !== 'string') {
          auditDependencies.audit.append({
            action: 'cart.product_removed',
            cartId,
            productId: Number(productId),
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
      row.components.map((component) => ({
        consumptionWarning:
          CATALOG_PRODUCTS.find((product) => product.id === component.product_id)?.packaging
            .consumptionLabel ?? null,
      })),
    ),
  };
}

export function getCart(
  repository: CartRepository,
  cartId: string,
  mixes?: PowderMixRepository,
): Cart | undefined {
  if (!repository.exists(cartId)) return undefined;
  const items = repository.listLines(cartId).map((row) => ({
    productId: String(row.product_id),
    product: toProductContract(row),
    quantity: row.quantity,
    lineTotalCents: row.price_cents * row.quantity,
  }));
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
  productId: string,
  mixes?: PowderMixRepository,
): Cart | 'CART_NOT_FOUND' | 'PRODUCT_NOT_FOUND' | 'CART_RESERVED' {
  if (!repository.exists(cartId)) return 'CART_NOT_FOUND';
  if (repository.isReserved(cartId)) return 'CART_RESERVED';
  if (!repository.productExists(productId)) return 'PRODUCT_NOT_FOUND';
  repository.addLine(cartId, productId);
  repository.touch(cartId);
  return getCart(repository, cartId, mixes) ?? 'CART_NOT_FOUND';
}

export function updateItem(
  repository: CartRepository,
  cartId: string,
  productId: string,
  quantity: number,
  mixes?: PowderMixRepository,
): Cart | 'CART_NOT_FOUND' | 'PRODUCT_NOT_IN_CART' | 'CART_RESERVED' {
  if (!repository.exists(cartId)) return 'CART_NOT_FOUND';
  if (repository.isReserved(cartId)) return 'CART_RESERVED';
  const changed =
    quantity === 0
      ? repository.removeLine(cartId, productId)
      : repository.updateLine(cartId, productId, quantity);
  if (!changed) return 'PRODUCT_NOT_IN_CART';
  repository.touch(cartId);
  return getCart(repository, cartId, mixes) ?? 'CART_NOT_FOUND';
}

export function removeItem(
  repository: CartRepository,
  cartId: string,
  productId: string,
  mixes?: PowderMixRepository,
): Cart | 'CART_NOT_FOUND' | 'PRODUCT_NOT_IN_CART' | 'CART_RESERVED' {
  if (!repository.exists(cartId)) return 'CART_NOT_FOUND';
  if (repository.isReserved(cartId)) return 'CART_RESERVED';
  if (!repository.removeLine(cartId, productId)) return 'PRODUCT_NOT_IN_CART';
  repository.touch(cartId);
  return getCart(repository, cartId, mixes) ?? 'CART_NOT_FOUND';
}
