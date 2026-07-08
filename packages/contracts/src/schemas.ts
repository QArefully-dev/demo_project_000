import { Type, type Static } from '@sinclair/typebox';

// ── Primitives ────────────────────────────────────────────

/** Monetary value in cents — integer >= 0. Never float. */
export const MoneyCents = Type.Number({ minimum: 0, multipleOf: 1 });

// ── Error ─────────────────────────────────────────────────

export const ErrorResponse = Type.Object({
  error: Type.String(),
  details: Type.Optional(Type.Unknown()),
});
export type ErrorResponse = Static<typeof ErrorResponse>;

// ── Product ───────────────────────────────────────────────

export const Product = Type.Object({
  id: Type.String(),
  name: Type.String(),
  description: Type.String(),
  priceCents: MoneyCents,
  imageUrl: Type.String(),
  category: Type.String(),
  stock: Type.Number({ minimum: 0, multipleOf: 1 }),
});
export type Product = Static<typeof Product>;

// ── Cart ──────────────────────────────────────────────────

export const CartLine = Type.Object({
  productId: Type.String(),
  product: Product,
  quantity: Type.Number({ minimum: 1, multipleOf: 1 }),
  lineTotalCents: MoneyCents,
});
export type CartLine = Static<typeof CartLine>;

export const Cart = Type.Object({
  id: Type.String(),
  items: Type.Array(CartLine),
  subtotalCents: MoneyCents,
  totalItems: Type.Number({ minimum: 0, multipleOf: 1 }),
});
export type Cart = Static<typeof Cart>;

// ── PromoCode ─────────────────────────────────────────────

export const PromoCode = Type.Object({
  code: Type.String(),
  discountPercent: Type.Number({ minimum: 0, maximum: 100 }),
  minItemCount: Type.Number({ minimum: 0, multipleOf: 1 }),
});
export type PromoCode = Static<typeof PromoCode>;

// ── Order ─────────────────────────────────────────────────

export const OrderLineItem = Type.Object({
  productId: Type.String(),
  productName: Type.String(),
  unitPriceCents: MoneyCents,
  quantity: Type.Number({ minimum: 1, multipleOf: 1 }),
  lineTotalCents: MoneyCents,
});
export type OrderLineItem = Static<typeof OrderLineItem>;

export const Order = Type.Object({
  id: Type.String(),
  items: Type.Array(OrderLineItem),
  subtotalCents: MoneyCents,
  discountCents: MoneyCents,
  totalCents: MoneyCents,
  promoApplied: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String(), // ISO 8601
});
export type Order = Static<typeof Order>;

// ── Request Bodies ────────────────────────────────────────

export const AddToCartBody = Type.Object({
  productId: Type.String(),
});
export type AddToCartBody = Static<typeof AddToCartBody>;

export const UpdateCartLineBody = Type.Object({
  productId: Type.String(),
  quantity: Type.Number({ minimum: 0, multipleOf: 1 }),
});
export type UpdateCartLineBody = Static<typeof UpdateCartLineBody>;

export const RemoveFromCartBody = Type.Object({
  productId: Type.String(),
});
export type RemoveFromCartBody = Static<typeof RemoveFromCartBody>;

export const ValidatePromoBody = Type.Object({
  promoCode: Type.String(),
  cartId: Type.String(),
});
export type ValidatePromoBody = Static<typeof ValidatePromoBody>;

/** Place-order payload. Single optional promo code — by design only one promo code can apply per order (no stacking). */
export const PlaceOrderBody = Type.Object({
  cartId: Type.String(),
  /** Optional promo code to apply. Only one code accepted — no stacking. */
  promoCode: Type.Optional(Type.String()),
  customerName: Type.String(),
  customerEmail: Type.String(),
  shippingAddress: Type.String(),
});
export type PlaceOrderBody = Static<typeof PlaceOrderBody>;

// ── Response Shapes ───────────────────────────────────────

/** Response returned after creating a new server-side cart. */
export const CreateCartResponse = Type.Object({
  cartId: Type.String(),
});
export type CreateCartResponse = Static<typeof CreateCartResponse>;

/** Response from promo code validation. When valid=true, {@link discountCents} and {@link totalCents} are server-computed from the cart subtotal at validation time. */
export const ValidatePromoResponse = Type.Object({
  valid: Type.Boolean(),
  promoCode: Type.Optional(PromoCode),
  error: Type.Optional(Type.String()),
  /** Discount amount in cents. Present only when valid=true. */
  discountCents: Type.Optional(MoneyCents),
  /** Cart total after discount in cents. Present only when valid=true. */
  totalCents: Type.Optional(MoneyCents),
});
export type ValidatePromoResponse = Static<typeof ValidatePromoResponse>;

/** Full product list response. */
export const ProductListResponse = Type.Array(Product);
export type ProductListResponse = Static<typeof ProductListResponse>;

/** Single product detail response. */
export const ProductDetailResponse = Product;
export type ProductDetailResponse = Static<typeof ProductDetailResponse>;

/** Response after placing an order. */
export const PlaceOrderResponse = Order;
export type PlaceOrderResponse = Static<typeof PlaceOrderResponse>;

/** Single order detail response. */
export const OrderDetailResponse = Order;
export type OrderDetailResponse = Static<typeof OrderDetailResponse>;

// ── Route Param Schemas ─────────────────────────────

/** Cart ID route parameter. */
export const CartIdParam = Type.Object({
  cartId: Type.String(),
});

/** Cart ID + product ID route parameter (used by cart item delete). */
export const CartIdAndProductIdParam = Type.Object({
  cartId: Type.String(),
  productId: Type.String(),
});

/** Order ID route parameter. */
export const OrderIdParam = Type.Object({
  orderId: Type.String(),
});

/** Product ID route parameter. */
export const ProductIdParam = Type.Object({
  id: Type.String(),
});
