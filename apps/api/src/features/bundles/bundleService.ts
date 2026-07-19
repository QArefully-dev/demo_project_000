import type { Cart } from '@shop/contracts/cart';
import type { CuratedBundle } from '@shop/contracts/bundles';
import { toProductContract } from '../../mappers/product.js';
import type { UnitOfWork } from '../../db/unitOfWork.js';
import { getCart } from '../cart/cartService.js';
import type { CartRepository } from '../cart/cartRepository.js';
import type { AuditContext } from '../audit/auditEvent.js';
import type { AuditWriter } from '../audit/auditService.js';
import type { PowderMixRepository } from '../powderizer/powderMixRepository.js';
import type { BundleComponentRow, BundleRepository, BundleRow } from './bundleRepository.js';

export interface BundleServiceDependencies {
  bundles: BundleRepository;
  carts: CartRepository;
  mixes: PowderMixRepository;
  unitOfWork: UnitOfWork;
  audit: AuditWriter;
}

export type BundleUnavailable = {
  error: 'BUNDLE_UNAVAILABLE';
  productIds: string[];
};

export type BundleMutationResult =
  Cart | 'CART_NOT_FOUND' | 'CART_RESERVED' | 'BUNDLE_NOT_FOUND' | BundleUnavailable;

export interface BundleService {
  list(productId?: string): CuratedBundle[];
  addToCart(cartId: string, bundleId: string, context?: AuditContext): BundleMutationResult;
}

function isVisible(bundle: BundleRow): boolean {
  return (
    bundle.active === 1 &&
    bundle.components.length >= 2 &&
    bundle.components.every((component) => component.product?.active === 1)
  );
}

/** Current persisted prices remain source of truth; no bundle price is stored. */
export function toCuratedBundle(bundle: BundleRow): CuratedBundle {
  if (!isVisible(bundle)) throw new Error('Cannot map a hidden curated bundle');
  const components = bundle.components.map((component) => {
    if (!component.product) throw new Error('Curated bundle component product is missing');
    return {
      product: toProductContract(component.product),
      quantity: component.quantity,
      lineTotalCents: component.product.price_cents * component.quantity,
    };
  });
  return {
    id: String(bundle.id),
    key: bundle.key,
    name: bundle.name,
    description: bundle.description,
    components,
    totalCents: components.reduce((total, component) => total + component.lineTotalCents, 0),
    available: components.every((component) => component.product.available),
  };
}

export function collectUnavailableComponentIds(
  cartId: string,
  components: readonly BundleComponentRow[],
  carts: CartRepository,
): string[] {
  const unavailable = new Set<string>();
  for (const component of components) {
    const product = component.product;
    if (
      !product ||
      product.active !== 1 ||
      !Number.isSafeInteger(component.quantity) ||
      component.quantity <= 0 ||
      product.stock_count <
        carts.lineQuantity(cartId, String(component.productId)) + component.quantity
    ) {
      unavailable.add(String(component.productId));
    }
  }
  return [...unavailable].sort((left, right) => Number(left) - Number(right));
}

function requireAuditContext(context: AuditContext | undefined): asserts context is AuditContext {
  if (!context) throw new Error('Bundle audit context is required');
}

function assertPersistedShape(bundle: BundleRow): void {
  if (bundle.components.length < 2) {
    throw new Error('Curated bundle integrity error: expected at least two components');
  }
  const productIds = new Set<number>();
  for (const component of bundle.components) {
    if (
      !component.product ||
      !Number.isSafeInteger(component.quantity) ||
      component.quantity <= 0
    ) {
      throw new Error('Curated bundle integrity error: invalid component');
    }
    if (productIds.has(component.productId)) {
      throw new Error('Curated bundle integrity error: duplicate component');
    }
    productIds.add(component.productId);
  }
}

/** Coordinates all-or-nothing ordinary cart-line mutations for fixed curated bundles. */
export function createBundleService(dependencies: BundleServiceDependencies): BundleService {
  return {
    list(productId) {
      return dependencies.bundles.list(productId).filter(isVisible).map(toCuratedBundle);
    },
    addToCart(cartId, bundleId, context) {
      requireAuditContext(context);
      return dependencies.unitOfWork.run(() => {
        if (!dependencies.carts.exists(cartId)) return 'CART_NOT_FOUND';
        if (dependencies.carts.isReserved(cartId)) return 'CART_RESERVED';

        const bundle = dependencies.bundles.findById(bundleId);
        if (!bundle || bundle.active !== 1) return 'BUNDLE_NOT_FOUND';
        assertPersistedShape(bundle);

        const unavailable = collectUnavailableComponentIds(
          cartId,
          bundle.components,
          dependencies.carts,
        );
        if (unavailable.length > 0) return { error: 'BUNDLE_UNAVAILABLE', productIds: unavailable };

        for (const component of bundle.components) {
          dependencies.carts.addLineQuantity(
            cartId,
            String(component.productId),
            component.quantity,
          );
        }
        dependencies.carts.touch(cartId);
        dependencies.audit.append({
          action: 'cart.bundle_added',
          cartId,
          bundleId: bundle.id,
          componentCount: bundle.components.length,
          quantity: bundle.components.reduce((total, component) => total + component.quantity, 0),
          context,
        });
        return getCart(dependencies.carts, cartId, dependencies.mixes) ?? 'CART_NOT_FOUND';
      });
    },
  };
}
