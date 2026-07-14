import { Type, type Static } from '@sinclair/typebox';
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

export const PowderMixPriceVersion = Type.Literal('powderizer-v1');
export type PowderMixPriceVersion = Static<typeof PowderMixPriceVersion>;

/** Maximum transport length. Domain enforces 40 NFC grapheme clusters. */
export const PowderMixCustomLabel = Type.String({ maxLength: 160 });

export const PowderMixComponentInput = Type.Object({
  productId: PositiveIntegerString,
  percentage: Type.Integer({ minimum: 1, maximum: 100 }),
});
export type PowderMixComponentInput = Static<typeof PowderMixComponentInput>;

export const PowderMixConfigInput = Type.Object({
  components: Type.Array(PowderMixComponentInput, { minItems: 2, maxItems: 5 }),
  bagSizeGrams: PowderMixBagSizeGrams,
  fineness: PowderMixFineness,
  customLabel: Type.Optional(PowderMixCustomLabel),
});
export type PowderMixConfigInput = Static<typeof PowderMixConfigInput>;

export const NormalizedPowderMixConfig = Type.Object({
  components: Type.Array(PowderMixComponentInput, { minItems: 2, maxItems: 5 }),
  bagSizeGrams: PowderMixBagSizeGrams,
  fineness: PowderMixFineness,
  customLabel: Type.Union([PowderMixCustomLabel, Type.Null()]),
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
};

export const PowderMixCartItem = Type.Object(PowderMixItemFields);
export type PowderMixCartItem = Static<typeof PowderMixCartItem>;

export const PowderMixOrderItem = Type.Object({
  ...PowderMixItemFields,
  snapshotVersion: Type.Literal(1),
});
export type PowderMixOrderItem = Static<typeof PowderMixOrderItem>;

export const PowderizerConfigResponse = Type.Object({
  eligibleProducts: Type.Array(Product),
  bagSizesGrams: Type.Array(PowderMixBagSizeGrams, { minItems: 3, maxItems: 3 }),
  finenessValues: Type.Array(PowderMixFineness, { minItems: 3, maxItems: 3 }),
  labelMaxGraphemes: Type.Literal(40),
  priceVersion: PowderMixPriceVersion,
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
