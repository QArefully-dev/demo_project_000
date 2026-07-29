import { Type, type Static } from '@sinclair/typebox';
import { TypeSystem } from '@sinclair/typebox/system';
import { MoneyCents, Uuid } from './common.js';
import { Product } from './products.js';
import { DeliveryClass, DeliverySummary } from './delivery.js';
import { CartLineConfigKey, CustomBlendSnapshot } from './customBlends.js';
import { ClearanceWindow, NextTierProgress } from './pricing.js';

const SafePositiveInteger = Type.Integer({ minimum: 1, maximum: Number.MAX_SAFE_INTEGER });
const SafeNonNegativeInteger = Type.Integer({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER });

export const CartLineVariantSnap = Type.Object(
  {
    variantId: Type.Integer({ minimum: 1 }),
    sku: Type.String({ minLength: 1, maxLength: 64 }),
    label: Type.String({ minLength: 1, maxLength: 160 }),
    weightGrams: Type.Integer({ minimum: 1 }),
    deliveryClass: DeliveryClass,
  },
  { additionalProperties: false },
);
export type CartLineVariantSnap = Static<typeof CartLineVariantSnap>;

const CartLineFields = Type.Object(
  {
    productId: Type.String({ minLength: 1 }),
    configKey: CartLineConfigKey,
    product: Product,
    variantSnap: Type.Optional(CartLineVariantSnap),
    /** Informational base price per tonne, resolved by the server for this variant. */
    perTonneCents: MoneyCents,
    /** Current server-resolved pack price after the line quantity's tier discount. */
    resolvedUnitPriceCents: MoneyCents,
    /** Omitted when this line already qualifies for the top tier. */
    nextTierProgress: Type.Optional(NextTierProgress),
    clearance: Type.Optional(ClearanceWindow),
    quantity: SafePositiveInteger,
    materialSubtotalCents: MoneyCents,
    blendingFeeCents: MoneyCents,
    discountableTotalCents: MoneyCents,
    lineTotalCents: MoneyCents,
    customBlend: Type.Optional(CustomBlendSnapshot),
  },
  { additionalProperties: false },
);

const CartLineConfigPair = TypeSystem.Type<unknown>('CartLineConfigPair', (_options, value) => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const line = value as { configKey?: unknown; customBlend?: { configKey?: unknown } };
  if (line.configKey === '') return line.customBlend === undefined;
  return (
    typeof line.configKey === 'string' &&
    typeof line.customBlend === 'object' &&
    line.customBlend !== null &&
    line.customBlend.configKey === line.configKey
  );
});

/** Plain lines use an empty config key; configured lines carry the matching specification key. */
export const CartLine = Type.Intersect([CartLineFields, CartLineConfigPair()]);
export type CartLine = Static<typeof CartLine>;

export const Cart = Type.Object({
  id: Uuid,
  items: Type.Array(CartLine),
  subtotalCents: MoneyCents,
  discountableSubtotalCents: MoneyCents,
  blendingFeeTotalCents: MoneyCents,
  totalItems: Type.Integer({ minimum: 0 }),
  deliveryPreview: Type.Optional(DeliverySummary),
});
export type Cart = Static<typeof Cart>;

export const AddToCartBody = Type.Object(
  {
    productId: Type.String({ minLength: 1 }),
    variantId: Type.Optional(Type.Integer({ minimum: 1 })),
    quantity: Type.Optional(SafePositiveInteger),
  },
  { additionalProperties: false },
);
export type AddToCartBody = Static<typeof AddToCartBody>;

export const BelowMoqError = Type.Object(
  {
    code: Type.Literal('BELOW_MOQ'),
    error: Type.String({ minLength: 1, maxLength: 500 }),
  },
  { additionalProperties: false },
);
export type BelowMoqError = Static<typeof BelowMoqError>;

export const UpdateCartLineBody = Type.Object(
  {
    productId: Type.String({ minLength: 1 }),
    variantId: Type.Optional(SafePositiveInteger),
    configKey: Type.Optional(CartLineConfigKey),
    quantity: SafeNonNegativeInteger,
  },
  { additionalProperties: false },
);
export type UpdateCartLineBody = Static<typeof UpdateCartLineBody>;

export const RemoveFromCartBody = Type.Object(
  {
    productId: Type.String({ minLength: 1 }),
    variantId: Type.Optional(SafePositiveInteger),
    configKey: Type.Optional(CartLineConfigKey),
  },
  { additionalProperties: false },
);
export type RemoveFromCartBody = Static<typeof RemoveFromCartBody>;

export const CreateCartResponse = Type.Object({ cartId: Uuid });
export type CreateCartResponse = Static<typeof CreateCartResponse>;
export const CartIdParam = Type.Object({ cartId: Uuid });
export const CartIdAndProductIdParam = Type.Object({
  cartId: Uuid,
  productId: Type.String({ minLength: 1 }),
});
