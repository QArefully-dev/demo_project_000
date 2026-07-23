import { Type, type Static } from '@sinclair/typebox';
import { MoneyCents, PositiveIntegerString, Uuid } from './common.js';
import { Product } from './products.js';
import { PowderMixCartItem } from './powderizer.js';
import { DeliveryClass, DeliverySummary } from './delivery.js';

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

export const CartLine = Type.Object({
  productId: Type.String({ minLength: 1 }),
  product: Product,
  variantSnap: Type.Optional(CartLineVariantSnap),
  /** Informational base price per tonne, resolved by the server for this variant. */
  perTonneCents: MoneyCents,
  /** Current server-resolved pack price after the line quantity's tier discount. */
  resolvedUnitPriceCents: MoneyCents,
  quantity: SafePositiveInteger,
  lineTotalCents: MoneyCents,
});
export type CartLine = Static<typeof CartLine>;

export const Cart = Type.Object({
  id: Uuid,
  items: Type.Array(CartLine),
  mixItems: Type.Array(PowderMixCartItem),
  subtotalCents: MoneyCents,
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

export const UpdateCartLineBody = Type.Object({
  productId: Type.String({ minLength: 1 }),
  variantId: Type.Optional(SafePositiveInteger),
  quantity: SafeNonNegativeInteger,
});
export type UpdateCartLineBody = Static<typeof UpdateCartLineBody>;

export const RemoveFromCartBody = Type.Object({
  productId: Type.String({ minLength: 1 }),
  variantId: Type.Optional(SafePositiveInteger),
});
export type RemoveFromCartBody = Static<typeof RemoveFromCartBody>;

export const CreateCartResponse = Type.Object({ cartId: Uuid });
export type CreateCartResponse = Static<typeof CreateCartResponse>;
export const CartIdParam = Type.Object({ cartId: Uuid });
export const CartIdAndProductIdParam = Type.Object({
  cartId: Uuid,
  productId: Type.String({ minLength: 1 }),
});

export const MixingGroupMismatchError = Type.Object(
  {
    code: Type.Literal('MIXING_GROUP_MISMATCH'),
    error: Type.String({ minLength: 1, maxLength: 500 }),
    conflictingProductIds: Type.Array(PositiveIntegerString, { minItems: 2, maxItems: 5 }),
    groupInfo: Type.Array(
      Type.Object(
        {
          productId: PositiveIntegerString,
          mixingGroup: Type.Union([Type.String(), Type.Null()]),
        },
        { additionalProperties: false },
      ),
      { minItems: 2, maxItems: 5 },
    ),
  },
  { additionalProperties: false },
);
export type MixingGroupMismatchError = Static<typeof MixingGroupMismatchError>;
