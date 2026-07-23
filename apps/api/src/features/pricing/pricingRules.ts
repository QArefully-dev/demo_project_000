import {
  MOQ_DEFAULT_SACKS,
  PALLET_WEIGHT_GRAMS,
  SACK_WEIGHT_GRAMS,
  TIER_LADDER,
  type PriceTier,
} from '@shop/contracts/pricing';

function requireNonNegativeSafeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative safe integer.`);
  }
}

function requirePositiveSafeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive safe integer.`);
  }
}

function roundHalfUp(numerator: number, denominator: number): number {
  requireNonNegativeSafeInteger(numerator, 'rounding numerator');
  requirePositiveSafeInteger(denominator, 'rounding denominator');
  const rounded = Math.floor((numerator + Math.floor(denominator / 2)) / denominator);
  if (!Number.isSafeInteger(rounded)) {
    throw new RangeError('Calculated price is outside the safe integer range.');
  }
  return rounded;
}

/** Resolves the highest qualifying discount from the uniform tonne-based ladder. */
export function resolveTierDiscountPct(
  quantity: number,
  weightGrams: number,
  tiers: readonly PriceTier[] = TIER_LADDER,
): number {
  requireNonNegativeSafeInteger(quantity, 'quantity');
  requirePositiveSafeInteger(weightGrams, 'weightGrams');

  const totalWeightGrams = quantity * weightGrams;
  if (!Number.isSafeInteger(totalWeightGrams)) {
    throw new RangeError('Total weight is outside the safe integer range.');
  }

  let highestQualifyingMinTonnes = 0;
  let discountPct = 0;
  for (const tier of tiers) {
    requirePositiveSafeInteger(tier.minTonnes, 'tier minTonnes');
    requireNonNegativeSafeInteger(tier.discountPct, 'tier discountPct');
    if (tier.discountPct > 100) {
      throw new RangeError('tier discountPct must not exceed 100.');
    }
    const tierMinimumWeightGrams = tier.minTonnes * PALLET_WEIGHT_GRAMS;
    if (!Number.isSafeInteger(tierMinimumWeightGrams)) {
      throw new RangeError('Tier minimum weight is outside the safe integer range.');
    }
    if (totalWeightGrams >= tierMinimumWeightGrams && tier.minTonnes > highestQualifyingMinTonnes) {
      highestQualifyingMinTonnes = tier.minTonnes;
      discountPct = tier.discountPct;
    }
  }
  return discountPct;
}

/** Resolves the per-unit price from the base price; tiers never compound. */
export function resolveUnitPriceCents(
  baseUnitPriceCents: number,
  quantity: number,
  weightGrams: number,
): number {
  requireNonNegativeSafeInteger(baseUnitPriceCents, 'baseUnitPriceCents');
  const discountPct = resolveTierDiscountPct(quantity, weightGrams);
  const multiplier = 100 - discountPct;
  if (baseUnitPriceCents > Number.MAX_SAFE_INTEGER / multiplier) {
    throw new RangeError('Calculated price is outside the safe integer range.');
  }
  return roundHalfUp(baseUnitPriceCents * multiplier, 100);
}

/** Derives an informational base-price-per-tonne figure using half-up minor-unit rounding. */
export function perTonneCents(baseUnitPriceCents: number, weightGrams: number): number {
  requireNonNegativeSafeInteger(baseUnitPriceCents, 'baseUnitPriceCents');
  requirePositiveSafeInteger(weightGrams, 'weightGrams');
  if (baseUnitPriceCents > Number.MAX_SAFE_INTEGER / PALLET_WEIGHT_GRAMS) {
    throw new RangeError('Calculated price is outside the safe integer range.');
  }
  return roundHalfUp(baseUnitPriceCents * PALLET_WEIGHT_GRAMS, weightGrams);
}

/** Checks a per-variant sack MOQ as a total line-weight floor. */
export function validateMoq(
  quantity: number,
  weightGrams: number,
  moqSacks: number = MOQ_DEFAULT_SACKS,
): boolean {
  requireNonNegativeSafeInteger(quantity, 'quantity');
  requirePositiveSafeInteger(weightGrams, 'weightGrams');
  requirePositiveSafeInteger(moqSacks, 'moqSacks');

  const totalWeightGrams = quantity * weightGrams;
  const minimumWeightGrams = moqSacks * SACK_WEIGHT_GRAMS;
  if (!Number.isSafeInteger(totalWeightGrams) || !Number.isSafeInteger(minimumWeightGrams)) {
    throw new RangeError('MOQ weight is outside the safe integer range.');
  }
  return totalWeightGrams >= minimumWeightGrams;
}
