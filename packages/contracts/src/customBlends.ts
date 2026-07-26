import { Type, type Static } from '@sinclair/typebox';
import { MoneyCents, PositiveIntegerString } from './common.js';
import { CatalogVariant, MixingGroup } from './products.js';

const SafePositiveInteger = Type.Integer({ minimum: 1, maximum: Number.MAX_SAFE_INTEGER });
const SafePercentage = Type.Integer({ minimum: 5, maximum: 50 });

/** Lowercase SHA-256 hex encoding of a canonical ingredient specification. */
export const CustomBlendConfigKey = Type.String({ pattern: '^[a-f0-9]{64}$' });
export type CustomBlendConfigKey = Static<typeof CustomBlendConfigKey>;

/** Config key for an ordinary cart line (`''`) or a configured Custom Blend line. */
export const CartLineConfigKey = Type.Union([Type.Literal(''), CustomBlendConfigKey]);
export type CartLineConfigKey = Static<typeof CartLineConfigKey>;

export const CustomBlendIngredientInput = Type.Object(
  {
    variantId: SafePositiveInteger,
    percentage: SafePercentage,
  },
  { additionalProperties: false },
);
export type CustomBlendIngredientInput = Static<typeof CustomBlendIngredientInput>;

/** Immutable ingredient facts persisted with a configured line and checkout quote. */
export const CustomBlendIngredientSnapshot = Type.Object(
  {
    variantId: SafePositiveInteger,
    productId: PositiveIntegerString,
    productName: Type.String({ minLength: 1, maxLength: 160 }),
    productDescription: Type.String({ minLength: 1, maxLength: 2_000 }),
    mixingGroup: MixingGroup,
    percentage: SafePercentage,
  },
  { additionalProperties: false },
);
export type CustomBlendIngredientSnapshot = Static<typeof CustomBlendIngredientSnapshot>;

/** Immutable Custom Blend specification. Base material remains represented by its cart line. */
export const CustomBlendSnapshot = Type.Object(
  {
    configKey: CustomBlendConfigKey,
    basePercentage: Type.Integer({ minimum: 50, maximum: 95 }),
    mixingGroup: MixingGroup,
    ingredients: Type.Array(CustomBlendIngredientSnapshot, { minItems: 1, maxItems: 4 }),
    blendingFeeCents: MoneyCents,
    madeToOrder: Type.Literal(true),
    returnable: Type.Literal(false),
  },
  { additionalProperties: false },
);
export type CustomBlendSnapshot = Static<typeof CustomBlendSnapshot>;

/** One active 25 kg base or compatible ingredient candidate. */
export const CustomBlendOption = Type.Object(
  {
    productId: PositiveIntegerString,
    productName: Type.String({ minLength: 1, maxLength: 160 }),
    productDescription: Type.String({ minLength: 1, maxLength: 2_000 }),
    mixingGroup: MixingGroup,
    variant: CatalogVariant,
  },
  { additionalProperties: false },
);
export type CustomBlendOption = Static<typeof CustomBlendOption>;

export const CustomBlendOptionsResponse = Type.Object(
  {
    base: CustomBlendOption,
    ingredients: Type.Array(CustomBlendOption),
  },
  { additionalProperties: false },
);
export type CustomBlendOptionsResponse = Static<typeof CustomBlendOptionsResponse>;

export const CustomBlendOptionsQuery = Type.Object(
  { baseVariantId: SafePositiveInteger },
  { additionalProperties: false },
);
export type CustomBlendOptionsQuery = Static<typeof CustomBlendOptionsQuery>;

export const CreateCustomBlendBody = Type.Object(
  {
    baseVariantId: SafePositiveInteger,
    ingredients: Type.Array(CustomBlendIngredientInput, { minItems: 1, maxItems: 4 }),
    quantity: Type.Optional(SafePositiveInteger),
  },
  { additionalProperties: false },
);
export type CreateCustomBlendBody = Static<typeof CreateCustomBlendBody>;

export const ReplaceCustomBlendBody = Type.Object(
  {
    baseVariantId: SafePositiveInteger,
    configKey: CustomBlendConfigKey,
    ingredients: Type.Array(CustomBlendIngredientInput, { minItems: 1, maxItems: 4 }),
  },
  { additionalProperties: false },
);
export type ReplaceCustomBlendBody = Static<typeof ReplaceCustomBlendBody>;

export const CustomBlendErrorCode = Type.Literal('CUSTOM_BLEND_INVALID');
export type CustomBlendErrorCode = Static<typeof CustomBlendErrorCode>;

export const CustomBlendErrorResponse = Type.Object(
  {
    code: CustomBlendErrorCode,
    error: Type.String({ minLength: 1, maxLength: 500 }),
  },
  { additionalProperties: false },
);
export type CustomBlendErrorResponse = Static<typeof CustomBlendErrorResponse>;
