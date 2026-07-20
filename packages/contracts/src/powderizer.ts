import { Type, type Static } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';
import { MoneyCents, PositiveIntegerString, Uuid } from './common.js';
import { Product } from './products.js';

export const PowderMixBagSizeGrams = Type.Union([
  Type.Literal(250),
  Type.Literal(500),
  Type.Literal(1000),
]);
export type PowderMixBagSizeGrams = Static<typeof PowderMixBagSizeGrams>;

export const PowderMixFineness = Type.Union([
  Type.Literal('coarse'),
  Type.Literal('standard'),
  Type.Literal('fine'),
]);
export type PowderMixFineness = Static<typeof PowderMixFineness>;

export const POWDER_MIX_BAG_COLOUR_SCHEME_VALUES = [
  'ultraviolet-cyan',
  'solar-flare',
  'deep-space',
  'acid-lilac',
  'monochrome-glitch',
] as const;
export const PowderMixBagColourScheme = Type.Union(
  POWDER_MIX_BAG_COLOUR_SCHEME_VALUES.map((value) => Type.Literal(value)),
);
export type PowderMixBagColourScheme = Static<typeof PowderMixBagColourScheme>;
export const DEFAULT_POWDER_MIX_BAG_COLOUR_SCHEME: PowderMixBagColourScheme = 'ultraviolet-cyan';

export const PowderMixUsageLabel = Type.Union([
  Type.Literal('Consumable powder'),
  Type.Literal('Not for consumption'),
  Type.Literal('Check ingredient labels'),
]);
export type PowderMixUsageLabel = Static<typeof PowderMixUsageLabel>;

export const PowderMixPriceVersion = Type.Literal('powderizer-v1');
export type PowderMixPriceVersion = Static<typeof PowderMixPriceVersion>;

/** Maximum transport length. Domain enforces 40 NFC grapheme clusters. */
export const PowderMixCustomLabel = Type.String({ maxLength: 160 });

export const PowderMixComponentInput = Type.Object(
  {
    productId: PositiveIntegerString,
    percentage: Type.Integer({ minimum: 1, maximum: 100 }),
  },
  { additionalProperties: false },
);
export type PowderMixComponentInput = Static<typeof PowderMixComponentInput>;

export const PowderMixConfigInput = Type.Object(
  {
    components: Type.Array(PowderMixComponentInput, { minItems: 2, maxItems: 5 }),
    bagSizeGrams: PowderMixBagSizeGrams,
    fineness: PowderMixFineness,
    customLabel: Type.Optional(PowderMixCustomLabel),
    bagColourScheme: Type.Optional(PowderMixBagColourScheme),
  },
  { additionalProperties: false },
);
export type PowderMixConfigInput = Static<typeof PowderMixConfigInput>;

export const NormalizedPowderMixConfig = Type.Object({
  components: Type.Array(PowderMixComponentInput, { minItems: 2, maxItems: 5 }),
  bagSizeGrams: PowderMixBagSizeGrams,
  fineness: PowderMixFineness,
  customLabel: Type.Union([PowderMixCustomLabel, Type.Null()]),
  bagColourScheme: PowderMixBagColourScheme,
});
export type NormalizedPowderMixConfig = Static<typeof NormalizedPowderMixConfig>;

export const PowderMixAllocation = Type.Object({
  productId: PositiveIntegerString,
  percentage: Type.Integer({ minimum: 1, maximum: 100 }),
  allocatedGrams: Type.Integer({ minimum: 1 }),
});
export type PowderMixAllocation = Static<typeof PowderMixAllocation>;

export const PowderMixQuote = Type.Object({
  priceVersion: PowderMixPriceVersion,
  config: NormalizedPowderMixConfig,
  allocations: Type.Array(PowderMixAllocation, { minItems: 2, maxItems: 5 }),
  packagingFeeCents: MoneyCents,
  finenessSurchargeCents: MoneyCents,
  unitPriceCents: MoneyCents,
  usageLabel: Type.Union([Type.Literal('Consumable powder'), Type.Literal('Not for consumption')]),
});
export type PowderMixQuote = Static<typeof PowderMixQuote>;

export const PowderMixComponent = Type.Object({
  productId: PositiveIntegerString,
  productName: Type.String({ minLength: 1, maxLength: 200 }),
  percentage: Type.Integer({ minimum: 1, maximum: 100 }),
  allocatedGrams: Type.Integer({ minimum: 1 }),
});
export type PowderMixComponent = Static<typeof PowderMixComponent>;

const PowderMixItemFields = {
  mixId: Uuid,
  components: Type.Array(PowderMixComponent, { minItems: 2, maxItems: 5 }),
  bagSizeGrams: PowderMixBagSizeGrams,
  fineness: PowderMixFineness,
  customLabel: Type.Union([PowderMixCustomLabel, Type.Null()]),
  priceVersion: PowderMixPriceVersion,
  unitPriceCents: MoneyCents,
  quantity: Type.Integer({ minimum: 1 }),
  lineTotalCents: MoneyCents,
  bagColourScheme: PowderMixBagColourScheme,
  usageLabel: Type.Union([Type.Literal('Consumable powder'), Type.Literal('Not for consumption')]),
};

export const PowderMixCartItem = Type.Object(PowderMixItemFields);
export type PowderMixCartItem = Static<typeof PowderMixCartItem>;

export const PowderMixOrderItemSnapshotV1 = Type.Object(
  {
    mixId: Uuid,
    components: Type.Array(PowderMixComponent, { minItems: 2, maxItems: 5 }),
    bagSizeGrams: PowderMixBagSizeGrams,
    fineness: PowderMixFineness,
    customLabel: Type.Union([PowderMixCustomLabel, Type.Null()]),
    priceVersion: PowderMixPriceVersion,
    unitPriceCents: MoneyCents,
    quantity: Type.Integer({ minimum: 1 }),
    lineTotalCents: MoneyCents,
    snapshotVersion: Type.Literal(1),
  },
  { additionalProperties: false },
);
export type PowderMixOrderItemSnapshotV1 = Static<typeof PowderMixOrderItemSnapshotV1>;

export const PowderMixOrderItemSnapshotV2 = Type.Object(
  {
    ...PowderMixItemFields,
    snapshotVersion: Type.Literal(2),
  },
  { additionalProperties: false },
);
export type PowderMixOrderItemSnapshotV2 = Static<typeof PowderMixOrderItemSnapshotV2>;

export const PowderMixOrderItem = Type.Union([
  PowderMixOrderItemSnapshotV1,
  PowderMixOrderItemSnapshotV2,
]);
export type PowderMixOrderItem = Static<typeof PowderMixOrderItem>;

export type NormalizedPowderMixOrderItem =
  | (PowderMixOrderItemSnapshotV1 & {
      bagColourScheme: PowderMixBagColourScheme;
      usageLabel: PowderMixUsageLabel;
    })
  | PowderMixOrderItemSnapshotV2;

function invalidOrderMixSnapshot(): never {
  throw new Error('Invalid order mix snapshot');
}

/** Strict raw v1 persisted-snapshot parser. */
export function parsePowderMixOrderItemSnapshotV1(value: unknown): PowderMixOrderItemSnapshotV1 {
  if (!Value.Check(PowderMixOrderItemSnapshotV1, value)) invalidOrderMixSnapshot();
  return value;
}

/** Strict raw v2 persisted-snapshot parser. */
export function parsePowderMixOrderItemSnapshotV2(value: unknown): PowderMixOrderItemSnapshotV2 {
  if (!Value.Check(PowderMixOrderItemSnapshotV2, value)) invalidOrderMixSnapshot();
  return value;
}

/** Adds only compatibility defaults; never accepts unvalidated storage data. */
export function normalizePowderMixOrderItemSnapshot(
  value: PowderMixOrderItem,
): NormalizedPowderMixOrderItem {
  if (value.snapshotVersion === 1) {
    return {
      ...parsePowderMixOrderItemSnapshotV1(value),
      bagColourScheme: DEFAULT_POWDER_MIX_BAG_COLOUR_SCHEME,
      usageLabel: 'Check ingredient labels',
    };
  }
  return parsePowderMixOrderItemSnapshotV2(value);
}

/** Strict persisted snapshot parser followed by explicit v1/v2 normalization. */
export function parsePowderMixOrderItemSnapshot(value: unknown): NormalizedPowderMixOrderItem {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    invalidOrderMixSnapshot();
  const snapshotVersion = (value as { snapshotVersion?: unknown }).snapshotVersion;
  if (snapshotVersion === 1)
    return normalizePowderMixOrderItemSnapshot(parsePowderMixOrderItemSnapshotV1(value));
  if (snapshotVersion === 2)
    return normalizePowderMixOrderItemSnapshot(parsePowderMixOrderItemSnapshotV2(value));
  return invalidOrderMixSnapshot();
}

export const PowderMixDailyRecipe = Type.Object({
  effectiveDate: Type.String({ pattern: '^\\d{4}-\\d{2}-\\d{2}$' }),
  name: Type.String({ minLength: 1, maxLength: 200 }),
  config: NormalizedPowderMixConfig,
});
export type PowderMixDailyRecipe = Static<typeof PowderMixDailyRecipe>;

export const PowderizerConfigResponse = Type.Object({
  eligibleProducts: Type.Array(Product),
  bagSizesGrams: Type.Array(PowderMixBagSizeGrams, { minItems: 3, maxItems: 3 }),
  finenessValues: Type.Array(PowderMixFineness, { minItems: 3, maxItems: 3 }),
  labelMaxGraphemes: Type.Literal(40),
  priceVersion: PowderMixPriceVersion,
  bagColourSchemes: Type.Array(PowderMixBagColourScheme, { minItems: 5, maxItems: 5 }),
  defaultBagColourScheme: PowderMixBagColourScheme,
  dailyRecipe: PowderMixDailyRecipe,
});
export type PowderizerConfigResponse = Static<typeof PowderizerConfigResponse>;

export const PowderMixQuoteBody = PowderMixConfigInput;
export type PowderMixQuoteBody = Static<typeof PowderMixQuoteBody>;
export const CreatePowderMixBody = PowderMixConfigInput;
export type CreatePowderMixBody = Static<typeof CreatePowderMixBody>;
export const UpdatePowderMixBody = PowderMixConfigInput;
export type UpdatePowderMixBody = Static<typeof UpdatePowderMixBody>;
export const UpdatePowderMixQuantityBody = Type.Object({
  quantity: Type.Integer({ minimum: 0 }),
});
export type UpdatePowderMixQuantityBody = Static<typeof UpdatePowderMixQuantityBody>;

export const CartIdAndMixIdParam = Type.Object({
  cartId: Uuid,
  mixId: Uuid,
});
export type CartIdAndMixIdParam = Static<typeof CartIdAndMixIdParam>;

export const PowderizerErrorCode = Type.Union([
  Type.Literal('MIX_COMPONENT_COUNT'),
  Type.Literal('MIX_DUPLICATE_COMPONENT'),
  Type.Literal('MIX_COMPONENT_INELIGIBLE'),
  Type.Literal('MIX_PERCENTAGE_INVALID'),
  Type.Literal('MIX_PERCENTAGE_TOTAL'),
  Type.Literal('MIX_BAG_SIZE_INVALID'),
  Type.Literal('MIX_FINENESS_INVALID'),
  Type.Literal('MIX_BAG_COLOUR_INVALID'),
  Type.Literal('MIX_LABEL_INVALID'),
  Type.Literal('MIX_NOT_FOUND'),
  Type.Literal('MIX_REQUOTE_REQUIRED'),
  Type.Literal('MIX_STOCK_UNAVAILABLE'),
]);
export type PowderizerErrorCode = Static<typeof PowderizerErrorCode>;

export const PowderizerValidationErrorResponse = Type.Object({
  code: Type.Union([
    Type.Literal('MIX_COMPONENT_COUNT'),
    Type.Literal('MIX_DUPLICATE_COMPONENT'),
    Type.Literal('MIX_COMPONENT_INELIGIBLE'),
    Type.Literal('MIX_PERCENTAGE_INVALID'),
    Type.Literal('MIX_PERCENTAGE_TOTAL'),
    Type.Literal('MIX_BAG_SIZE_INVALID'),
    Type.Literal('MIX_FINENESS_INVALID'),
    Type.Literal('MIX_BAG_COLOUR_INVALID'),
    Type.Literal('MIX_LABEL_INVALID'),
  ]),
  error: Type.String({ minLength: 1, maxLength: 500 }),
  field: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
});
export type PowderizerValidationErrorResponse = Static<typeof PowderizerValidationErrorResponse>;

export const PowderMixNotFoundErrorResponse = Type.Object({
  code: Type.Literal('MIX_NOT_FOUND'),
  error: Type.String({ minLength: 1, maxLength: 500 }),
});
export type PowderMixNotFoundErrorResponse = Static<typeof PowderMixNotFoundErrorResponse>;

export const PowderMixRequoteRequiredConflictResponse = Type.Object({
  code: Type.Literal('MIX_REQUOTE_REQUIRED'),
  error: Type.String({ minLength: 1, maxLength: 500 }),
  mixes: Type.Array(
    Type.Object({
      mixId: Uuid,
      oldUnitPriceCents: MoneyCents,
      newUnitPriceCents: MoneyCents,
    }),
    { minItems: 1 },
  ),
});
export type PowderMixRequoteRequiredConflictResponse = Static<
  typeof PowderMixRequoteRequiredConflictResponse
>;

export const PowderMixStockUnavailableConflictResponse = Type.Object({
  code: Type.Literal('MIX_STOCK_UNAVAILABLE'),
  error: Type.String({ minLength: 1, maxLength: 500 }),
  mixIds: Type.Array(Uuid, { minItems: 1 }),
  productIds: Type.Array(PositiveIntegerString, { minItems: 1 }),
});
export type PowderMixStockUnavailableConflictResponse = Static<
  typeof PowderMixStockUnavailableConflictResponse
>;

export const PowderMixConflictResponse = Type.Union([
  PowderMixRequoteRequiredConflictResponse,
  PowderMixStockUnavailableConflictResponse,
]);
export type PowderMixConflictResponse = Static<typeof PowderMixConflictResponse>;

export const CustomPowderMix = PowderMixCartItem;
export type CustomPowderMix = PowderMixCartItem;
export const CustomPowderConfig = PowderizerConfigResponse;
export type CustomPowderConfig = PowderizerConfigResponse;

export const CustomPowderFeaturedBlend = Type.Object(
  {
    id: PositiveIntegerString,
    name: Type.String({ minLength: 1, maxLength: 200 }),
    description: Type.String({ minLength: 1, maxLength: 500 }),
    config: NormalizedPowderMixConfig,
    imageSetId: Type.String({ minLength: 1 }),
    category: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);
export type CustomPowderFeaturedBlend = Static<typeof CustomPowderFeaturedBlend>;
