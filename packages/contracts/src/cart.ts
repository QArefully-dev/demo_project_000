import { Type, type Static } from '@sinclair/typebox';
import { MoneyCents, Uuid } from './common.js';
import { Product } from './products.js';
import { PowderMixCartItem } from './powderizer.js';

export const CartLine = Type.Object({
  productId: Type.String({ minLength: 1 }),
  product: Product,
  quantity: Type.Integer({ minimum: 1 }),
  lineTotalCents: MoneyCents,
});
export type CartLine = Static<typeof CartLine>;

export const Cart = Type.Object({
  id: Uuid,
  items: Type.Array(CartLine),
  mixItems: Type.Array(PowderMixCartItem),
  subtotalCents: MoneyCents,
  totalItems: Type.Integer({ minimum: 0 }),
});
export type Cart = Static<typeof Cart>;

export const AddToCartBody = Type.Object({ productId: Type.String({ minLength: 1 }) });
export type AddToCartBody = Static<typeof AddToCartBody>;
export const UpdateCartLineBody = Type.Object({
  productId: Type.String({ minLength: 1 }),
  quantity: Type.Integer({ minimum: 0 }),
});
export type UpdateCartLineBody = Static<typeof UpdateCartLineBody>;
export const RemoveFromCartBody = Type.Object({ productId: Type.String({ minLength: 1 }) });
export type RemoveFromCartBody = Static<typeof RemoveFromCartBody>;

export const CreateCartResponse = Type.Object({ cartId: Uuid });
export type CreateCartResponse = Static<typeof CreateCartResponse>;
export const CartIdParam = Type.Object({ cartId: Uuid });
export const CartIdAndProductIdParam = Type.Object({
  cartId: Uuid,
  productId: Type.String({ minLength: 1 }),
});
