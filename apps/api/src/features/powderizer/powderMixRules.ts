import type {
  PowderMixBagSizeGrams,
  PowderMixBagColourScheme,
  PowderMixFineness,
  PowderMixPriceVersion,
} from '@shop/contracts/powderizer';
import {
  DEFAULT_POWDER_MIX_BAG_COLOUR_SCHEME,
  POWDER_MIX_BAG_COLOUR_SCHEME_VALUES,
} from '@shop/contracts/powderizer';
import { MIXING_GROUPS } from '@shop/catalog';
import type { CategoryFacts } from '@shop/catalog';
import {
  type CombinedPowderMixFacts,
  type NormalizedPowderMixConfig,
  type PowderMixAllocation,
  PowderMixDomainError,
  type PowderMixPrice,
  type PowderMixProduct,
  type PowderMixQuote,
  type PowderMixStockLine,
  type PowderMixStockRequirement,
} from './powderizerTypes.js';

export const POWDER_MIX_PRICE_VERSION: PowderMixPriceVersion = 'powderizer-v1';
export const POWDER_MIX_BAG_SIZES = [250, 500, 1000] as const;
export const POWDER_MIX_FINENESS_VALUES = ['coarse', 'standard', 'fine'] as const;
export const POWDER_MIX_BAG_COLOUR_SCHEMES = POWDER_MIX_BAG_COLOUR_SCHEME_VALUES;
export const POWDER_MIX_LABEL_MAX_GRAPHEMES = 40;
export const POWDER_MIX_PACKAGING_FEE_CENTS: Readonly<Record<number, number>> = {
  250: 250,
  500: 400,
  1000: 600,
};
export const POWDER_MIX_FINENESS_SURCHARGE_CENTS = 0;

type UnknownRecord = Record<string, unknown>;

function domainError(code: PowderMixDomainError['code'], message: string, field?: string): never {
  throw new PowderMixDomainError(code, message, field);
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readProductId(value: unknown): number {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && /^[1-9][0-9]*$/.test(value)
        ? Number(value)
        : Number.NaN;
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    domainError('MIX_COMPONENT_INELIGIBLE', 'Mix component product ID is invalid.', 'components');
  }
  return parsed;
}

function requirePositiveInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    domainError('MIX_PERCENTAGE_INVALID', 'Mix percentages must be positive integers.', field);
  }
  return value as number;
}

function findProduct(products: readonly PowderMixProduct[], productId: number): PowderMixProduct {
  const product = products.find((candidate) => candidate.id === productId);
  if (
    !product ||
    product.mixable !== true ||
    !Number.isSafeInteger(product.mixUnitGrams) ||
    (product.mixUnitGrams ?? 0) <= 0
  ) {
    domainError('MIX_COMPONENT_INELIGIBLE', 'Mix component is not eligible.', 'components');
  }
  return product;
}

/** NFC-normalizes a label and returns null for an empty value. */
export function normalizePowderMixLabel(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') {
    domainError('MIX_LABEL_INVALID', 'Mix label must be text.', 'customLabel');
  }
  const normalized = value.normalize('NFC').trim();
  if (normalized.length === 0) return null;
  if (/[<>&\p{Cc}\p{Cf}]/u.test(normalized)) {
    domainError('MIX_LABEL_INVALID', 'Mix label contains unsupported characters.', 'customLabel');
  }
  if (countPowderMixLabelGraphemes(normalized) > POWDER_MIX_LABEL_MAX_GRAPHEMES) {
    domainError('MIX_LABEL_INVALID', 'Mix label exceeds 40 grapheme clusters.', 'customLabel');
  }
  return normalized;
}

export function countPowderMixLabelGraphemes(value: string): number {
  return Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value))
    .length;
}

export function normalizePowderMixBagColourScheme(value: unknown): PowderMixBagColourScheme {
  if (value === undefined) return DEFAULT_POWDER_MIX_BAG_COLOUR_SCHEME;
  if (
    typeof value !== 'string' ||
    !POWDER_MIX_BAG_COLOUR_SCHEMES.includes(value as PowderMixBagColourScheme)
  ) {
    domainError('MIX_BAG_COLOUR_INVALID', 'Mix bag colour scheme is invalid.', 'bagColourScheme');
  }
  return value as PowderMixBagColourScheme;
}

export const ALLOWED_MIXING_GROUPS = new Set(MIXING_GROUPS);

export function validateMixingGroupCompat(products: readonly PowderMixProduct[]): void {
  const groups = new Set(products.map((product) => product.mixingGroup));
  if (groups.has(null)) {
    domainError(
      'MIX_COMPONENT_INELIGIBLE',
      'All mix components must belong to a mixing group.',
      'components',
    );
  }
  if (groups.size > 1) {
    domainError(
      'MIX_COMPONENT_INELIGIBLE',
      'All mix components must belong to the same mixing group.',
      'components',
    );
  }
  for (const group of groups) {
    if (!ALLOWED_MIXING_GROUPS.has(group as (typeof MIXING_GROUPS)[number])) {
      domainError(
        'MIX_COMPONENT_INELIGIBLE',
        `Mixing group '${group}' is not recognised.`,
        'components',
      );
    }
  }
}

function parseDetailsJson(json: string | null): CategoryFacts | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as Record<string, unknown>;
    if (typeof parsed !== 'object' || parsed === null) return null;
    return parsed as CategoryFacts;
  } catch {
    return null;
  }
}

export function deriveCombinedPowderMixFacts(
  products: readonly PowderMixProduct[],
): CombinedPowderMixFacts {
  const ingredients = new Set<string>();
  const allergens = new Set<string>();
  const intendedUse = new Set<string>();
  const safety = new Set<string>();

  for (const product of products) {
    const facts = parseDetailsJson(product.detailsJson);
    if (!facts) continue;

    if ('ingredients' in facts && Array.isArray(facts.ingredients)) {
      for (const ingredient of facts.ingredients) ingredients.add(String(ingredient));
    }
    if ('allergens' in facts && Array.isArray(facts.allergens)) {
      for (const allergen of facts.allergens) allergens.add(String(allergen));
    }
    if (facts.intendedUse) {
      intendedUse.add(facts.intendedUse);
    }
    if ('handling' in facts && facts.handling) {
      safety.add(facts.handling);
    }
    if ('hazardStatement' in facts && facts.hazardStatement) {
      safety.add(facts.hazardStatement);
    }
    if ('ppe' in facts && Array.isArray(facts.ppe)) {
      for (const item of facts.ppe) safety.add(String(item));
    }
  }

  return {
    ingredients: [...ingredients].sort(),
    allergens: [...allergens].sort(),
    intendedUse: [...intendedUse],
    safety: [...safety],
  };
}

/** Derives Powderizer safety copy only from canonical product warnings. */
export function derivePowderMixUsageLabel(
  components: readonly Pick<PowderMixProduct, 'consumptionWarning'>[],
): 'Consumable powder' | 'Not for consumption' {
  return components.some((component) => component.consumptionWarning === 'Not for consumption')
    ? 'Not for consumption'
    : 'Consumable powder';
}

/** Validates untrusted config, resolves eligibility, and sorts components by numeric product ID. */
export function normalizePowderMixConfig(
  input: unknown,
  products: readonly PowderMixProduct[],
): NormalizedPowderMixConfig {
  if (!isRecord(input) || !Array.isArray(input.components)) {
    domainError('MIX_COMPONENT_COUNT', 'Mix must contain two to five components.', 'components');
  }
  if (input.components.length < 2 || input.components.length > 5) {
    domainError('MIX_COMPONENT_COUNT', 'Mix must contain two to five components.', 'components');
  }

  const components = input.components.map((candidate, index) => {
    if (!isRecord(candidate)) {
      domainError('MIX_COMPONENT_INELIGIBLE', 'Mix component is invalid.', `components.${index}`);
    }
    const productId = readProductId(candidate.productId);
    const percentage = requirePositiveInteger(
      candidate.percentage,
      `components.${index}.percentage`,
    );
    if (percentage > 100) {
      domainError(
        'MIX_PERCENTAGE_INVALID',
        'Mix percentages must not exceed 100.',
        `components.${index}.percentage`,
      );
    }
    findProduct(products, productId);
    return { productId, percentage };
  });
  const ids = new Set(components.map((component) => component.productId));
  if (ids.size !== components.length) {
    domainError('MIX_DUPLICATE_COMPONENT', 'Mix components must be unique.', 'components');
  }
  const resolvedProducts = components.map((component) =>
    findProduct(products, component.productId),
  );
  validateMixingGroupCompat(resolvedProducts);
  const percentageTotal = components.reduce((total, component) => total + component.percentage, 0);
  if (percentageTotal !== 100) {
    domainError('MIX_PERCENTAGE_TOTAL', 'Mix percentages must total 100.', 'components');
  }
  if (!POWDER_MIX_BAG_SIZES.includes(input.bagSizeGrams as PowderMixBagSizeGrams)) {
    domainError('MIX_BAG_SIZE_INVALID', 'Mix bag size is invalid.', 'bagSizeGrams');
  }
  if (!POWDER_MIX_FINENESS_VALUES.includes(input.fineness as PowderMixFineness)) {
    domainError('MIX_FINENESS_INVALID', 'Mix fineness is invalid.', 'fineness');
  }

  return {
    components: components.sort((left, right) => left.productId - right.productId),
    bagSizeGrams: input.bagSizeGrams as PowderMixBagSizeGrams,
    fineness: input.fineness as PowderMixFineness,
    customLabel: normalizePowderMixLabel(input.customLabel),
    bagColourScheme: normalizePowderMixBagColourScheme(input.bagColourScheme),
  };
}

/** Stable quote identity from all normalized presentation-affecting config values. */
export function createPowderMixQuoteKey(config: NormalizedPowderMixConfig): string {
  return JSON.stringify({
    components: config.components,
    bagSizeGrams: config.bagSizeGrams,
    fineness: config.fineness,
    customLabel: config.customLabel,
    bagColourScheme: config.bagColourScheme,
  });
}

/** Allocates every bag gram; fractional remainder ties resolve to lowest product ID. */
export function allocatePowderMixGrams(
  config: Pick<NormalizedPowderMixConfig, 'components' | 'bagSizeGrams'>,
): readonly PowderMixAllocation[] {
  const allocations = config.components.map((component) => ({
    ...component,
    allocatedGrams: Math.floor((config.bagSizeGrams * component.percentage) / 100),
    discardedNumerator: (config.bagSizeGrams * component.percentage) % 100,
  }));
  const allocatedTotal = allocations.reduce(
    (total, component) => total + component.allocatedGrams,
    0,
  );
  const remainder = config.bagSizeGrams - allocatedTotal;
  const recipients = [...allocations].sort(
    (left, right) =>
      right.discardedNumerator - left.discardedNumerator || left.productId - right.productId,
  );
  for (let index = 0; index < remainder; index += 1) {
    const recipient = recipients[index];
    if (!recipient) throw new Error('Allocation remainder has no component recipient.');
    recipient.allocatedGrams += 1;
  }
  return allocations.map((allocation) => {
    if (allocation.allocatedGrams <= 0) {
      throw new Error('Validated mix allocation must be positive.');
    }
    return {
      productId: allocation.productId,
      percentage: allocation.percentage,
      allocatedGrams: allocation.allocatedGrams,
    };
  });
}

export function parsePowderMixPriceVersion(value: unknown): PowderMixPriceVersion {
  if (value !== POWDER_MIX_PRICE_VERSION) {
    domainError(
      'MIX_REQUOTE_REQUIRED',
      'Mix quote uses an unsupported price version.',
      'priceVersion',
    );
  }
  return POWDER_MIX_PRICE_VERSION;
}

/** Prices allocations using server product rows; client prices never participate. */
export function calculatePowderMixPrice(
  allocations: readonly PowderMixAllocation[],
  products: readonly PowderMixProduct[],
  bagSizeGrams: PowderMixBagSizeGrams,
  priceVersion: unknown = POWDER_MIX_PRICE_VERSION,
): PowderMixPrice {
  const parsedVersion = parsePowderMixPriceVersion(priceVersion);
  const packagingFeeCents = POWDER_MIX_PACKAGING_FEE_CENTS[bagSizeGrams];
  if (packagingFeeCents === undefined) {
    domainError('MIX_BAG_SIZE_INVALID', 'Mix bag size is invalid.', 'bagSizeGrams');
  }
  const ingredientChargeCents = allocations.reduce((total, allocation) => {
    const product = findProduct(products, allocation.productId);
    const effectivePriceCents =
      product.blendSourceVariantId != null && product.sourceVariantPriceCents != null
        ? product.sourceVariantPriceCents
        : product.priceCents;
    if (!Number.isSafeInteger(effectivePriceCents) || effectivePriceCents < 0) {
      throw new Error(`Product ${product.id} has invalid persisted price.`);
    }
    const mixUnitGrams = product.mixUnitGrams as number;
    return total + Math.ceil((effectivePriceCents * allocation.allocatedGrams) / mixUnitGrams);
  }, 0);
  const unitPriceCents =
    ingredientChargeCents + packagingFeeCents + POWDER_MIX_FINENESS_SURCHARGE_CENTS;
  if (!Number.isSafeInteger(unitPriceCents) || unitPriceCents < 0) {
    throw new Error('Calculated mix price is outside safe integer range.');
  }
  return {
    priceVersion: parsedVersion,
    packagingFeeCents,
    finenessSurchargeCents: POWDER_MIX_FINENESS_SURCHARGE_CENTS,
    unitPriceCents,
  };
}

export function quotePowderMix(
  input: unknown,
  products: readonly PowderMixProduct[],
): PowderMixQuote {
  const config = normalizePowderMixConfig(input, products);
  const allocations = allocatePowderMixGrams(config);
  const resolvedProducts = config.components.map((component) =>
    findProduct(products, component.productId),
  );
  return {
    config,
    allocations,
    ...calculatePowderMixPrice(allocations, products, config.bagSizeGrams),
    usageLabel: derivePowderMixUsageLabel(resolvedProducts),
    combinedFacts: deriveCombinedPowderMixFacts(resolvedProducts),
  };
}

/** Returns sorted aggregate retail-bag requirements for every custom mix line. */
export function calculatePowderMixStockRequirements(
  mixes: readonly PowderMixStockLine[],
  products: readonly PowderMixProduct[],
): readonly PowderMixStockRequirement[] {
  const totals = new Map<number, number>();
  for (const mix of mixes) {
    if (!Number.isSafeInteger(mix.quantity) || mix.quantity <= 0) {
      throw new Error('Mix quantity must be a positive integer.');
    }
    for (const allocation of mix.allocations) {
      if (!Number.isSafeInteger(allocation.allocatedGrams) || allocation.allocatedGrams <= 0) {
        throw new Error('Mix allocation must be a positive integer.');
      }
      const product = findProduct(products, allocation.productId);
      const effectiveMixUnitGrams =
        product.blendSourceVariantId != null && product.sourceVariantMixUnitGrams != null
          ? product.sourceVariantMixUnitGrams
          : (product.mixUnitGrams as number);
      const bags = Math.ceil((allocation.allocatedGrams * mix.quantity) / effectiveMixUnitGrams);
      totals.set(product.id, (totals.get(product.id) ?? 0) + bags);
    }
  }
  return [...totals.entries()]
    .map(([productId, bagEquivalents]) => ({ productId, bagEquivalents }))
    .sort((left, right) => left.productId - right.productId);
}
