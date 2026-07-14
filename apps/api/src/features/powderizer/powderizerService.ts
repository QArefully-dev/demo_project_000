import type {
  PowderMixConfigInput,
  PowderMixQuote as PowderMixQuoteContract,
  PowderizerConfigResponse,
} from '@shop/contracts/powderizer';
import { toProductContract } from '../../mappers/product.js';
import type { UnitOfWork } from '../../db/unitOfWork.js';
import type { CartRepository } from '../cart/cartRepository.js';
import type { ProductRepository, ProductRow } from '../catalog/productRepository.js';
import {
  POWDER_MIX_BAG_SIZES,
  POWDER_MIX_FINENESS_VALUES,
  POWDER_MIX_LABEL_MAX_GRAPHEMES,
  quotePowderMix,
} from './powderMixRules.js';
import type { PowderMixRepository, PowderMixRow } from './powderMixRepository.js';
import {
  PowderMixDomainError,
  type PowderMixProduct,
  type PowderMixQuote,
} from './powderizerTypes.js';

export type PowderMixMutationResult = 'CART_NOT_FOUND' | 'CART_RESERVED' | 'MIX_NOT_FOUND';

export interface PowderizerService {
  config(): PowderizerConfigResponse;
  quote(input: PowderMixConfigInput): PowderMixQuoteContract;
  create(cartId: string, input: PowderMixConfigInput): string | PowderMixMutationResult;
  update(
    cartId: string,
    mixId: string,
    input: PowderMixConfigInput,
  ): PowderMixMutationResult | undefined;
  requote(cartId: string, mixId: string): PowderMixMutationResult | undefined;
  updateQuantity(
    cartId: string,
    mixId: string,
    quantity: number,
  ): PowderMixMutationResult | undefined;
  remove(cartId: string, mixId: string): PowderMixMutationResult | undefined;
}

function toMixProduct(row: ProductRow): PowderMixProduct {
  return {
    id: row.id,
    name: row.name,
    priceCents: row.price_cents,
    mixable: row.mixable === 1,
    mixUnitGrams: row.mix_unit_grams ?? null,
  };
}

function toContractQuote(quote: PowderMixQuote): PowderMixQuoteContract {
  return {
    priceVersion: quote.priceVersion,
    config: {
      components: quote.config.components.map((component) => ({
        productId: String(component.productId),
        percentage: component.percentage,
      })),
      bagSizeGrams: quote.config.bagSizeGrams,
      fineness: quote.config.fineness,
      customLabel: quote.config.customLabel,
    },
    allocations: quote.allocations.map((allocation) => ({
      productId: String(allocation.productId),
      percentage: allocation.percentage,
      allocatedGrams: allocation.allocatedGrams,
    })),
    packagingFeeCents: quote.packagingFeeCents,
    finenessSurchargeCents: quote.finenessSurchargeCents,
    unitPriceCents: quote.unitPriceCents,
  };
}

/** Server-authoritative mix configuration, quoting, and cart-scoped persistence. */
export function createPowderizerService(dependencies: {
  unitOfWork: UnitOfWork;
  carts: CartRepository;
  products: ProductRepository;
  mixes: PowderMixRepository;
}): PowderizerService {
  const loadRequestedProducts = (productIds: readonly number[]): PowderMixProduct[] => {
    const uniqueIds = [...new Set(productIds)];
    const products = dependencies.products.listMixProducts(uniqueIds).map(toMixProduct);
    if (products.length !== uniqueIds.length) {
      throw new PowderMixDomainError(
        'MIX_COMPONENT_INELIGIBLE',
        'Mix component is not eligible.',
        'components',
      );
    }
    return products;
  };

  const quote = (input: unknown): PowderMixQuote => {
    const components =
      typeof input === 'object' && input !== null && 'components' in input
        ? (input as { components?: unknown }).components
        : undefined;
    const ids = Array.isArray(components)
      ? [
          ...new Set(
            components
              .map((component) =>
                typeof component === 'object' && component !== null && 'productId' in component
                  ? Number((component as { productId?: unknown }).productId)
                  : Number.NaN,
              )
              .filter((id) => Number.isSafeInteger(id) && id > 0),
          ),
        ]
      : [];
    const products = loadRequestedProducts(ids);
    return quotePowderMix(input, products);
  };

  const savedQuote = (row: PowderMixRow): PowderMixQuote => {
    const components = dependencies.mixes.listComponents(row.id);
    const ids = components.map((component) => component.product_id);
    const products = loadRequestedProducts(ids);
    return quotePowderMix(
      {
        components: components.map((component) => ({
          productId: String(component.product_id),
          percentage: component.percentage,
        })),
        bagSizeGrams: row.bag_size_grams,
        fineness: row.fineness,
        customLabel: row.custom_label ?? undefined,
      },
      products,
    );
  };

  const mutate = <T>(cartId: string, action: () => T): T | 'CART_NOT_FOUND' | 'CART_RESERVED' =>
    dependencies.unitOfWork.run(() => {
      if (!dependencies.carts.exists(cartId)) return 'CART_NOT_FOUND';
      if (dependencies.carts.isReserved(cartId)) return 'CART_RESERVED';
      const result = action();
      dependencies.carts.touch(cartId);
      return result;
    });

  return {
    config() {
      return {
        eligibleProducts: dependencies.products.listEligibleMixProducts().map(toProductContract),
        bagSizesGrams: [...POWDER_MIX_BAG_SIZES],
        finenessValues: [...POWDER_MIX_FINENESS_VALUES],
        labelMaxGraphemes: POWDER_MIX_LABEL_MAX_GRAPHEMES,
        priceVersion: 'powderizer-v1',
      };
    },
    quote(input) {
      return toContractQuote(quote(input));
    },
    create(cartId, input) {
      return mutate(cartId, () => {
        const mixQuote = quote(input);
        const mixId = crypto.randomUUID();
        dependencies.mixes.create({
          id: mixId,
          cartId,
          quantity: 1,
          bagSizeGrams: mixQuote.config.bagSizeGrams,
          fineness: mixQuote.config.fineness,
          customLabel: mixQuote.config.customLabel,
          priceVersion: mixQuote.priceVersion,
          quotedUnitPriceCents: mixQuote.unitPriceCents,
          allocations: mixQuote.allocations,
        });
        return mixId;
      });
    },
    update(cartId, mixId, input) {
      return mutate(cartId, () => {
        if (!dependencies.mixes.find(cartId, mixId)) return 'MIX_NOT_FOUND';
        const mixQuote = quote(input);
        dependencies.mixes.replace(mixId, {
          bagSizeGrams: mixQuote.config.bagSizeGrams,
          fineness: mixQuote.config.fineness,
          customLabel: mixQuote.config.customLabel,
          priceVersion: mixQuote.priceVersion,
          quotedUnitPriceCents: mixQuote.unitPriceCents,
          allocations: mixQuote.allocations,
        });
        return undefined;
      });
    },
    requote(cartId, mixId) {
      return mutate(cartId, () => {
        const persisted = dependencies.mixes.find(cartId, mixId);
        if (!persisted) return 'MIX_NOT_FOUND';
        const mixQuote = savedQuote(persisted);
        dependencies.mixes.updateQuote(mixId, {
          bagSizeGrams: mixQuote.config.bagSizeGrams,
          fineness: mixQuote.config.fineness,
          customLabel: mixQuote.config.customLabel,
          priceVersion: mixQuote.priceVersion,
          quotedUnitPriceCents: mixQuote.unitPriceCents,
          allocations: mixQuote.allocations,
        });
        return undefined;
      });
    },
    updateQuantity(cartId, mixId, quantity) {
      return mutate(cartId, () => {
        const changed =
          quantity === 0
            ? dependencies.mixes.remove(cartId, mixId)
            : dependencies.mixes.updateQuantity(cartId, mixId, quantity);
        return changed ? undefined : 'MIX_NOT_FOUND';
      });
    },
    remove(cartId, mixId) {
      return mutate(cartId, () =>
        dependencies.mixes.remove(cartId, mixId) ? undefined : 'MIX_NOT_FOUND',
      );
    },
  };
}
