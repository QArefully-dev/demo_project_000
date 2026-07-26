import { createHash } from 'node:crypto';
import { CUSTOM_BLEND_FEE_CENTS, type CustomBlendIngredientInput } from '@shop/contracts';

const MIN_INGREDIENTS = 1;
const MAX_INGREDIENTS = 4;
const MIN_PERCENTAGE = 5;
const MAX_INGREDIENT_PERCENTAGE = 50;
const MAX_INGREDIENT_TOTAL = 50;

export interface CanonicalCustomBlendSpec {
  ingredients: CustomBlendIngredientInput[];
  basePercentage: number;
  canonicalJson: string;
  configKey: string;
}

export interface CustomBlendLinePricing {
  materialSubtotalCents: number;
  blendingFeeCents: number;
  discountableTotalCents: number;
  lineTotalCents: number;
}

function requirePositiveSafeInteger(value: unknown, name: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive safe integer.`);
  }
}

function requireNonNegativeSafeInteger(value: unknown, name: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative safe integer.`);
  }
}

/**
 * Validates and sorts ingredient ratios without changing caller-owned input.
 * Canonical order is ascending numeric variant ID.
 */
export function canonicalizeCustomBlendIngredients(
  ingredients: readonly CustomBlendIngredientInput[],
): CustomBlendIngredientInput[] {
  // Array-ness is checked through an `unknown` alias: narrowing `Array.isArray` against the
  // declared readonly array would collapse the element type to `any` and silently drop
  // ingredient typing for the whole canonicalization path.
  const candidate: unknown = ingredients;
  if (
    !Array.isArray(candidate) ||
    ingredients.length < MIN_INGREDIENTS ||
    ingredients.length > MAX_INGREDIENTS
  ) {
    throw new RangeError(`ingredients must contain ${MIN_INGREDIENTS}-${MAX_INGREDIENTS} entries.`);
  }

  const seenVariantIds = new Set<number>();
  const normalized = ingredients.map((ingredient, index) => {
    if (typeof ingredient !== 'object' || ingredient === null || Array.isArray(ingredient)) {
      throw new TypeError(`ingredients[${index}] must be an object.`);
    }

    const { variantId, percentage } = ingredient;
    requirePositiveSafeInteger(variantId, `ingredients[${index}].variantId`);
    if (
      typeof percentage !== 'number' ||
      !Number.isSafeInteger(percentage) ||
      percentage < MIN_PERCENTAGE ||
      percentage > MAX_INGREDIENT_PERCENTAGE
    ) {
      throw new RangeError(
        `ingredients[${index}].percentage must be an integer between ${MIN_PERCENTAGE} and ${MAX_INGREDIENT_PERCENTAGE}.`,
      );
    }
    if (seenVariantIds.has(variantId)) {
      throw new RangeError(`ingredients contains duplicate variantId ${variantId}.`);
    }
    seenVariantIds.add(variantId);
    return { variantId, percentage };
  });

  const ingredientTotal = normalized.reduce(
    (total, ingredient) => total + ingredient.percentage,
    0,
  );
  if (ingredientTotal > MAX_INGREDIENT_TOTAL) {
    throw new RangeError(`ingredient percentage total must not exceed ${MAX_INGREDIENT_TOTAL}.`);
  }

  return normalized.sort((left, right) => left.variantId - right.variantId);
}

/** Serializes normalized ingredients with stable property and array order for identity hashing. */
export function canonicalCustomBlendJson(
  canonicalIngredients: readonly CustomBlendIngredientInput[],
): string {
  const normalized = canonicalizeCustomBlendIngredients(canonicalIngredients);
  return JSON.stringify(normalized);
}

/** Computes lowercase SHA-256 identity key from canonical ingredient JSON only. */
export function hashCustomBlendCanonicalJson(canonicalJson: string): string {
  return createHash('sha256').update(canonicalJson).digest('hex');
}

/** Validates full input, rejects base-as-ingredient, and derives canonical blend facts. */
export function normalizeCustomBlendSpec(
  baseVariantId: number,
  ingredients: readonly CustomBlendIngredientInput[],
): CanonicalCustomBlendSpec {
  requirePositiveSafeInteger(baseVariantId, 'baseVariantId');
  const normalizedIngredients = canonicalizeCustomBlendIngredients(ingredients);
  if (normalizedIngredients.some((ingredient) => ingredient.variantId === baseVariantId)) {
    throw new RangeError('baseVariantId must not also be an ingredient variantId.');
  }

  const ingredientTotal = normalizedIngredients.reduce(
    (total, ingredient) => total + ingredient.percentage,
    0,
  );
  const basePercentage = 100 - ingredientTotal;
  if (basePercentage < 50 || basePercentage > 95) {
    throw new RangeError('base percentage must be between 50 and 95.');
  }

  const canonicalJson = canonicalCustomBlendJson(normalizedIngredients);
  return {
    ingredients: normalizedIngredients,
    basePercentage,
    canonicalJson,
    configKey: hashCustomBlendCanonicalJson(canonicalJson),
  };
}

/**
 * Calculates configured-line totals. Fee applies once per line, never per sack,
 * and only material subtotal remains discountable.
 */
export function calculateCustomBlendLinePricing(
  resolvedUnitPriceCents: number,
  quantity: number,
  blendingFeeCents: number = CUSTOM_BLEND_FEE_CENTS,
): CustomBlendLinePricing {
  requireNonNegativeSafeInteger(resolvedUnitPriceCents, 'resolvedUnitPriceCents');
  requirePositiveSafeInteger(quantity, 'quantity');
  requireNonNegativeSafeInteger(blendingFeeCents, 'blendingFeeCents');
  if (resolvedUnitPriceCents > Number.MAX_SAFE_INTEGER / quantity) {
    throw new RangeError('Material subtotal is outside the safe integer range.');
  }

  const materialSubtotalCents = resolvedUnitPriceCents * quantity;
  if (materialSubtotalCents > Number.MAX_SAFE_INTEGER - blendingFeeCents) {
    throw new RangeError('Line total is outside the safe integer range.');
  }
  const lineTotalCents = materialSubtotalCents + blendingFeeCents;
  return {
    materialSubtotalCents,
    blendingFeeCents,
    discountableTotalCents: materialSubtotalCents,
    lineTotalCents,
  };
}
