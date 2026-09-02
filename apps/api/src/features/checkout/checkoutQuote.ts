import type { Cart } from '@shop/contracts/cart';
import {
  CURRENT_PERSISTED_CHECKOUT_QUOTE_VERSION,
  parsePersistedCheckoutQuote as parseContractPersistedCheckoutQuote,
  type PaymentMethod,
  type PersistedCheckoutQuoteV10,
  type PersistedCheckoutQuoteV8,
} from '@shop/contracts/payments';
import type { Country } from '@shop/contracts/country';
import { countryProfile } from '@shop/contracts/country-profiles';
import { formatPostalAddress } from '@shop/contracts/address';
import { calculateDiscount, resolvePromoScope, type ValidPromo } from '../promos/promoService.js';
import type { PersistedCheckoutQuote } from '../payments/paymentRepository.js';
import type { CheckoutParams, ResolvedCheckoutCommitments } from './checkoutTypes.js';
import type { InventoryReservationAllocation } from '../inventory/inventoryTypes.js';
import { quoteCartDelivery } from '../delivery/deliveryRules.js';
import {
  calculateInvoiceTotals,
  type InvoiceAmounts,
  type InvoiceVatRate,
} from '../tradeCredit/tradeCreditRules.js';

type CreditTerms = 'net_30' | 30;

/** Optional server-owned facts supplied by the method-aware checkout workflow. */
export interface CheckoutQuoteAccounting {
  country?: Country;
  paymentMethod?: PaymentMethod;
  userId?: number | string | null;
  companyId?: number | string | null;
  netCents?: number;
  vatRateBasisPoints?: InvoiceVatRate;
  vatCents?: number;
  grossCents?: number;
  terms?: CreditTerms | null;
  termsDays?: 30 | null;
  preparedAt?: string;
  invoiceTotals?: Partial<InvoiceAmounts> & { vatRateBasisPoints?: InvoiceVatRate };
}

type CheckoutQuoteCheckout = Omit<CheckoutParams, 'cardNumber' | 'cardExpiry' | 'cardCvc'> &
  Partial<Pick<CheckoutParams, 'cardNumber' | 'cardExpiry' | 'cardCvc'>> & {
    country?: Country;
    paymentMethod?: PaymentMethod;
    companyId?: number | string | null;
    netCents?: number;
    vatRateBasisPoints?: InvoiceVatRate;
    vatCents?: number;
    grossCents?: number;
    terms?: CreditTerms | null;
    termsDays?: 30 | null;
    preparedAt?: string;
    /** Compatibility seam for workflows that keep method facts under an accounting object. */
    accounting?: CheckoutQuoteAccounting;
    invoiceTotals?: Partial<InvoiceAmounts> & { vatRateBasisPoints?: InvoiceVatRate };
  };

interface CheckoutQuoteFacts extends CheckoutQuoteAccounting {
  /** The workflow may supply the accounting tuple under this descriptive alias. */
  totals?: Partial<InvoiceAmounts> & { vatRateBasisPoints?: InvoiceVatRate };
}

function firstDefined<T>(...values: readonly (T | undefined)[]): T | undefined {
  return values.find((value): value is T => value !== undefined);
}

function normalizePositiveId(value: unknown, name: string): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value < 1) throw new Error(`Invalid ${name}`);
    return value;
  }
  if (typeof value !== 'string' || !/^[1-9][0-9]*$/.test(value)) {
    throw new Error(`Invalid ${name}`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new Error(`Invalid ${name}`);
  return parsed;
}

function normalizeQuoteUserId(value: unknown): number | null {
  if (value === null) return null;
  const normalized = normalizePositiveId(value, 'quote user');
  if (normalized === null) throw new Error('Invalid quote user');
  return normalized;
}

function assertMoney(value: unknown, name: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Invalid ${name}`);
  }
}

function assertRate(value: unknown): asserts value is InvoiceVatRate {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > 10_000) {
    throw new Error('Invalid VAT rate');
  }
}

function assertTerms(terms: unknown, termsDays: unknown): asserts terms is CreditTerms {
  if (terms !== 'net_30' && terms !== 30) {
    throw new Error('Trade-credit quote requires net-30 terms');
  }
  if (termsDays !== undefined && termsDays !== 30) {
    throw new Error('Trade-credit quote requires thirty-day terms');
  }
}

function resolveQuoteFacts(params: {
  cart: Cart;
  checkout: CheckoutQuoteCheckout;
  accounting?: CheckoutQuoteFacts;
  baseTotalCents: number;
  deliveryChargeCents: number;
  discountCents: number;
}): {
  country: Country;
  paymentMethod: PaymentMethod;
  companyId: number | null;
  userId: number | null;
  netCents: number;
  vatRateBasisPoints: InvoiceVatRate;
  vatCents: number;
  grossCents: number;
  terms?: CreditTerms;
  termsDays?: 30;
  preparedAt?: string;
} {
  const checkout = params.checkout;
  const accounting = params.accounting;
  const country = firstDefined(accounting?.country, checkout.country) ?? 'UK';
  const paymentMethod =
    firstDefined(accounting?.paymentMethod, checkout.paymentMethod) ?? ('card' as const);
  const companyId = normalizePositiveId(
    firstDefined(accounting?.companyId, checkout.companyId),
    'quote company',
  );
  const userId = normalizeQuoteUserId(firstDefined(accounting?.userId, checkout.userId));
  const suppliedTotals = firstDefined(
    accounting?.invoiceTotals,
    accounting?.totals,
    checkout.invoiceTotals,
  );
  const suppliedNet = firstDefined(
    accounting?.netCents,
    checkout.netCents,
    suppliedTotals?.netCents,
  );
  const suppliedVatRate = firstDefined(
    accounting?.vatRateBasisPoints,
    checkout.vatRateBasisPoints,
    suppliedTotals?.vatRateBasisPoints as InvoiceVatRate | undefined,
  );
  const suppliedVat = firstDefined(
    accounting?.vatCents,
    checkout.vatCents,
    suppliedTotals?.vatCents,
  );
  const suppliedGross = firstDefined(
    accounting?.grossCents,
    checkout.grossCents,
    suppliedTotals?.grossCents,
  );
  const suppliedTerms = firstDefined(accounting?.terms, checkout.terms);
  const suppliedTermsDays = firstDefined(accounting?.termsDays, checkout.termsDays);
  const preparedAt = firstDefined(accounting?.preparedAt, checkout.preparedAt);

  if (paymentMethod === 'card') {
    if (companyId !== null) throw new Error('Card quote cannot carry a company');
    if (suppliedTerms !== undefined && suppliedTerms !== null) {
      throw new Error('Card quote cannot carry trade-credit terms');
    }
    if (suppliedTermsDays !== undefined && suppliedTermsDays !== null) {
      throw new Error('Card quote cannot carry trade-credit terms');
    }
    if (suppliedNet !== undefined && suppliedNet !== params.baseTotalCents) {
      throw new Error('Card quote net does not match checkout total');
    }
    if (suppliedVatRate !== undefined && suppliedVatRate !== 0) {
      throw new Error('Card quote VAT must be zero');
    }
    if (suppliedVat !== undefined && suppliedVat !== 0) {
      throw new Error('Card quote VAT must be zero');
    }
    if (suppliedGross !== undefined && suppliedGross !== params.baseTotalCents) {
      throw new Error('Card quote gross does not match checkout total');
    }
    return {
      country,
      paymentMethod,
      companyId: null,
      userId,
      netCents: params.baseTotalCents,
      vatRateBasisPoints: 0,
      vatCents: 0,
      grossCents: params.baseTotalCents,
      ...(preparedAt === undefined ? {} : { preparedAt }),
    };
  }

  if (companyId === null) throw new Error('Trade-credit quote requires a company');
  if (userId === null) throw new Error('Trade-credit quote requires an authenticated user');
  const terms = suppliedTerms ?? 'net_30';
  assertTerms(terms, suppliedTermsDays);
  const profileRate = countryProfile(country).vatRateBasisPoints;
  const vatRateBasisPoints = suppliedVatRate ?? profileRate;
  assertRate(vatRateBasisPoints);
  if (vatRateBasisPoints !== profileRate) {
    throw new Error('Trade-credit quote VAT rate does not match country profile');
  }
  // Invoice totals are derived from canonical GBP-pence cart facts. Supplied tuples are accepted
  // only as a checked server hand-off; they cannot override merchandise, discount, delivery, or
  // the country-owned VAT rate.
  const calculated = calculateInvoiceTotals({
    merchandiseCents: params.cart.subtotalCents,
    promoDiscountCents: params.discountCents,
    deliveryCents: params.deliveryChargeCents,
    vatRateBasisPoints,
  });
  for (const [name, supplied, expected] of [
    ['netCents', suppliedNet, calculated.netCents],
    ['vatCents', suppliedVat, calculated.vatCents],
    ['grossCents', suppliedGross, calculated.grossCents],
  ] as const) {
    if (supplied !== undefined) {
      assertMoney(supplied, name);
      if (supplied !== expected)
        throw new Error(`Trade-credit quote ${name} does not match totals`);
    }
  }
  return {
    country,
    paymentMethod,
    companyId,
    userId,
    ...calculated,
    vatRateBasisPoints,
    terms,
    ...(suppliedTermsDays === undefined ? {} : { termsDays: 30 as const }),
    ...(preparedAt === undefined ? {} : { preparedAt }),
  };
}

/** Maps cart data once into an immutable, persistence-safe checkout quote. */
export function createCheckoutQuote(params: {
  cart: Cart;
  checkout: CheckoutQuoteCheckout;
  /** Server-resolved destination, billing party, slot, and buyer reference. */
  resolved: ResolvedCheckoutCommitments;
  promo: ValidPromo | undefined;
  createdAt: string;
  inventoryAllocations: readonly InventoryReservationAllocation[];
  /** Identity and payment facts resolved by the checkout workflow. */
  country?: Country;
  paymentMethod?: PaymentMethod;
  userId?: number | string | null;
  companyId?: number | string | null;
  netCents?: number;
  vatRateBasisPoints?: InvoiceVatRate;
  vatCents?: number;
  grossCents?: number;
  terms?: CreditTerms | null;
  termsDays?: 30 | null;
  preparedAt?: string;
  invoiceTotals?: Partial<InvoiceAmounts> & { vatRateBasisPoints?: InvoiceVatRate };
  accounting?: CheckoutQuoteFacts;
  totals?: Partial<InvoiceAmounts> & { vatRateBasisPoints?: InvoiceVatRate };
}): PersistedCheckoutQuote {
  const promoScope = params.promo
    ? resolvePromoScope({ promo: params.promo, cart: params.cart })
    : undefined;
  const discountCents = params.promo
    ? calculateDiscount({
        promo: params.promo,
        discountableSubtotalCents: promoScope!.discountBaseCents,
      })
    : 0;

  const variantLines: PersistedCheckoutQuoteV8['variantLines'] = params.cart.items.map((item) => {
    const snap = item.variantSnap;
    const line = {
      productId: item.productId,
      variantId: snap?.variantId ?? 0,
      productName: item.product.name,
      variantLabel: snap?.label ?? item.product.name,
      unitPriceCents: resolvedLineUnitPrice(item),
      weightGrams: snap?.weightGrams ?? 1000,
      deliveryClass: snap?.deliveryClass ?? 'parcel',
      quantity: item.quantity,
      lineTotalCents: item.lineTotalCents,
      consumptionClassification: item.product.consumptionClassification ?? 'non-food',
    };
    // Plain lines keep the historical shape: the money split and specification are written only
    // where a configured blend exists, so ordinary quotes stay byte-identical to prior releases.
    if (!item.customBlend) return line;
    return {
      ...line,
      materialSubtotalCents: item.materialSubtotalCents,
      blendingFeeCents: item.blendingFeeCents,
      discountableTotalCents: item.discountableTotalCents,
      customBlend: item.customBlend,
    };
  });

  const deliverySummary = quoteCartDelivery(params.cart);
  const baseTotalCents = params.cart.subtotalCents - discountCents + deliverySummary.chargeCents;
  const checkout = params.checkout;
  const accounting: CheckoutQuoteFacts = {
    ...checkout.accounting,
    ...params.accounting,
    ...(params.country === undefined ? {} : { country: params.country }),
    ...(params.paymentMethod === undefined ? {} : { paymentMethod: params.paymentMethod }),
    ...(params.userId === undefined ? {} : { userId: params.userId }),
    ...(params.companyId === undefined ? {} : { companyId: params.companyId }),
    ...(params.netCents === undefined ? {} : { netCents: params.netCents }),
    ...(params.vatRateBasisPoints === undefined
      ? {}
      : { vatRateBasisPoints: params.vatRateBasisPoints }),
    ...(params.vatCents === undefined ? {} : { vatCents: params.vatCents }),
    ...(params.grossCents === undefined ? {} : { grossCents: params.grossCents }),
    ...(params.terms === undefined ? {} : { terms: params.terms }),
    ...(params.termsDays === undefined ? {} : { termsDays: params.termsDays }),
    ...(params.preparedAt === undefined ? {} : { preparedAt: params.preparedAt }),
    ...(params.invoiceTotals === undefined ? {} : { invoiceTotals: params.invoiceTotals }),
    ...(params.totals === undefined ? {} : { totals: params.totals }),
  };
  const facts = resolveQuoteFacts({
    cart: params.cart,
    checkout,
    accounting,
    baseTotalCents,
    deliveryChargeCents: deliverySummary.chargeCents,
    discountCents,
  });

  const quote: PersistedCheckoutQuoteV10 = {
    version: CURRENT_PERSISTED_CHECKOUT_QUOTE_VERSION,
    cartId: params.cart.id,
    customer: {
      name: checkout.customerName.trim(),
      email: checkout.customerEmail.trim().toLowerCase(),
      deliveryAddress: params.resolved.deliveryAddress,
      // The legacy free-text address is rendered here and nowhere else, so the structured value
      // and the flat `orders.shipping_address` column can never disagree.
      shippingAddress: formatPostalAddress(params.resolved.deliveryAddress),
    },
    userId: facts.userId,
    // Only the validated server promo reaches the immutable quote; a raw checkout code is not a
    // pricing fact and must not be allowed to diverge from the applied discount.
    promoCode: params.promo?.code ?? null,
    subtotalCents: params.cart.subtotalCents,
    discountBaseCents: promoScope?.discountBaseCents ?? 0,
    promoCategoryScope: params.promo?.categoryScope ?? null,
    discountCents,
    totalCents: facts.grossCents,
    lines: [],
    variantLines,
    deliverySummary,
    inventoryAllocations: params.inventoryAllocations.map((allocation) => ({
      productId: String(allocation.variantId),
      reservedQuantity: allocation.reservedQuantity,
      backorderedQuantity: allocation.backorderedQuantity,
    })),
    billingEntity: params.resolved.billingEntity,
    deliverySlot: params.resolved.deliverySlot,
    purchaseOrderReference: params.resolved.purchaseOrderReference,
    createdAt: params.createdAt,
    country: facts.country,
    paymentMethod: facts.paymentMethod,
    companyId: facts.companyId === null ? null : String(facts.companyId),
    netCents: facts.netCents,
    vatRateBasisPoints: facts.vatRateBasisPoints,
    vatCents: facts.vatCents,
    grossCents: facts.grossCents,
    ...(facts.terms === undefined ? {} : { terms: facts.terms }),
    ...(facts.termsDays === undefined ? {} : { termsDays: facts.termsDays }),
    ...(facts.preparedAt === undefined ? {} : { preparedAt: facts.preparedAt }),
  };
  // Validate at the quote boundary so malformed conditional rows can never reach persistence or
  // a later finalizer. The contract parser also enforces V9 configured-line integrity.
  return parseContractPersistedCheckoutQuote(quote);
}

/**
 * Unit price comes from the material subtotal, never the line total: a blending fee is charged
 * once per configured line, so dividing the line total by quantity would smear it across sacks.
 */
function resolvedLineUnitPrice(item: Cart['items'][number]): number {
  const { materialSubtotalCents, blendingFeeCents, lineTotalCents, quantity } = item;
  if (
    !Number.isSafeInteger(materialSubtotalCents) ||
    !Number.isSafeInteger(blendingFeeCents) ||
    !Number.isSafeInteger(lineTotalCents) ||
    !Number.isSafeInteger(quantity) ||
    quantity < 1 ||
    materialSubtotalCents < 0 ||
    blendingFeeCents < 0 ||
    materialSubtotalCents % quantity !== 0 ||
    materialSubtotalCents + blendingFeeCents !== lineTotalCents ||
    materialSubtotalCents !== item.resolvedUnitPriceCents * quantity
  ) {
    throw new Error('Cart line has an invalid resolved price.');
  }
  return materialSubtotalCents / quantity;
}
