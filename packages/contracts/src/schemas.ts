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

// ── Success ───────────────────────────────────────────────

export const SuccessResponse = Type.Object({
  success: Type.Literal(true),
});
export type SuccessResponse = Static<typeof SuccessResponse>;

// ── Product ───────────────────────────────────────────────

export const Product = Type.Object({
  id: Type.String(),
  name: Type.String(),
  description: Type.String(),
  priceCents: MoneyCents,
  imageUrl: Type.String(),
  category: Type.String(),
  stock: Type.Number({ minimum: 0, multipleOf: 1 }),
  slug: Type.String(),
  compareAtPriceCents: Type.Optional(MoneyCents),
  salesCount: Type.Number({ minimum: 0, multipleOf: 1 }),
});
export type Product = Static<typeof Product>;

// ── Product Query ────────────────────────────────────────

export const ProductSort = Type.Union([
  Type.Literal('newest'),
  Type.Literal('price_asc'),
  Type.Literal('price_desc'),
  Type.Literal('bestselling'),
]);

export const ProductQuery = Type.Object({
  q: Type.Optional(Type.String()),
  category: Type.Optional(Type.String()),
  onSale: Type.Optional(Type.Boolean()),
  sort: Type.Optional(ProductSort),
  page: Type.Optional(Type.Number({ minimum: 1, maximum: 10000, multipleOf: 1 })),
  pageSize: Type.Optional(Type.Number({ minimum: 1, maximum: 48, multipleOf: 1 })),
});
export type ProductQuery = Static<typeof ProductQuery>;

// ── Product List (Paginated) ──────────────────────────────

export const ProductListPaginatedResponse = Type.Object({
  items: Type.Array(Product),
  total: Type.Number({ minimum: 0, multipleOf: 1 }),
  page: Type.Number({ minimum: 1, multipleOf: 1 }),
  pageSize: Type.Number({ minimum: 1, multipleOf: 1 }),
});
export type ProductListPaginatedResponse = Static<typeof ProductListPaginatedResponse>;

// ── Categories / Bestsellers / Related ────────────────────

export const CategoriesResponse = Type.Array(Type.String());
export type CategoriesResponse = Static<typeof CategoriesResponse>;

export const BestsellersResponse = Type.Array(Product);
export type BestsellersResponse = Static<typeof BestsellersResponse>;

export const RelatedResponse = Type.Array(Product);
export type RelatedResponse = Static<typeof RelatedResponse>;

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

// ── User (public) ─────────────────────────────────────────

export const PublicUser = Type.Object({
  id: Type.String(),
  email: Type.String(),
  displayName: Type.String(),
  role: Type.Union([Type.Literal('customer'), Type.Literal('admin')]),
});
export type PublicUser = Static<typeof PublicUser>;

// ── Mailbox Message ───────────────────────────────────────

export const MailboxMessage = Type.Object({
  id: Type.String(),
  recipient: Type.String(),
  subject: Type.String(),
  body: Type.String(),
  kind: Type.String(),
  created: Type.String(),
});
export type MailboxMessage = Static<typeof MailboxMessage>;

export const MailboxListResponse = Type.Array(MailboxMessage);
export type MailboxListResponse = Static<typeof MailboxListResponse>;

// ── Auth Request Bodies ───────────────────────────────────

export const SignupBody = Type.Object({
  email: Type.String(),
  password: Type.String(),
  displayName: Type.String(),
});
export type SignupBody = Static<typeof SignupBody>;

export const LoginBody = Type.Object({
  email: Type.String(),
  password: Type.String(),
});
export type LoginBody = Static<typeof LoginBody>;

export const ForgotPasswordBody = Type.Object({
  email: Type.String(),
});
export type ForgotPasswordBody = Static<typeof ForgotPasswordBody>;

export const ResetPasswordBody = Type.Object({
  token: Type.String(),
  newPassword: Type.String(),
});
export type ResetPasswordBody = Static<typeof ResetPasswordBody>;

export const ChangePasswordBody = Type.Object({
  currentPassword: Type.String(),
  newPassword: Type.String(),
});
export type ChangePasswordBody = Static<typeof ChangePasswordBody>;

// ── Favourites ────────────────────────────────────────────

export const AddFavouriteBody = Type.Object({
  productId: Type.String(),
});
export type AddFavouriteBody = Static<typeof AddFavouriteBody>;

export const FavouriteIdParam = Type.Object({
  productId: Type.String(),
});
export type FavouriteIdParam = Static<typeof FavouriteIdParam>;

export const FavouritesListResponse = Type.Array(Product);
export type FavouritesListResponse = Static<typeof FavouritesListResponse>;

// ── PromoCode ─────────────────────────────────────────────

export const PromoCodeKind = Type.Union([Type.Literal('percent'), Type.Literal('fixed')]);

export const PromoCode = Type.Object({
  code: Type.String(),
  discountPercent: Type.Number({ minimum: 0, maximum: 100 }),
  minItemCount: Type.Number({ minimum: 0, multipleOf: 1 }),
  kind: PromoCodeKind,
  amountCents: Type.Optional(MoneyCents),
  minSubtotalCents: Type.Optional(MoneyCents),
});
export type PromoCode = Static<typeof PromoCode>;

// ── Promo Validation ──────────────────────────────────────

export const PromoValidationErrorCode = Type.Union([
  Type.Literal('EXPIRED'),
  Type.Literal('NOT_STARTED'),
  Type.Literal('MIN_ITEMS'),
  Type.Literal('MIN_SUBTOTAL'),
  Type.Literal('USAGE_LIMIT'),
  Type.Literal('AUTH_REQUIRED'),
  Type.Literal('INVALID'),
]);

export const ValidatePromoBody = Type.Object({
  promoCode: Type.String(),
  cartId: Type.String(),
});
export type ValidatePromoBody = Static<typeof ValidatePromoBody>;

export const ValidatePromoResponse = Type.Object({
  valid: Type.Boolean(),
  promoCode: Type.Optional(PromoCode),
  error: Type.Optional(Type.String()),
  errorCode: Type.Optional(PromoValidationErrorCode),
  discountCents: Type.Optional(MoneyCents),
  totalCents: Type.Optional(MoneyCents),
});
export type ValidatePromoResponse = Static<typeof ValidatePromoResponse>;

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

// ── Payment ───────────────────────────────────────────────

export const PaymentBody = Type.Object({
  cartId: Type.String(),
  promoCode: Type.Optional(Type.String()),
  customerName: Type.String(),
  customerEmail: Type.String(),
  shippingAddress: Type.String(),
  cardNumber: Type.String(),
  cardExpiry: Type.String(),
  cardCvc: Type.String(),
  idempotencyKey: Type.String(),
});
export type PaymentBody = Static<typeof PaymentBody>;

export const PaymentErrorResponse = Type.Object({
  error: Type.String(),
  failureReason: Type.Optional(
    Type.Union([Type.Literal('CARD_DECLINED'), Type.Literal('GATEWAY_TIMEOUT')]),
  ),
});
export type PaymentErrorResponse = Static<typeof PaymentErrorResponse>;

// ── Request Bodies (legacy) ───────────────────────────────

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

export const CreateCartResponse = Type.Object({
  cartId: Type.String(),
});
export type CreateCartResponse = Static<typeof CreateCartResponse>;

export const ProductListResponse = Type.Array(Product);
export type ProductListResponse = Static<typeof ProductListResponse>;

export const ProductDetailResponse = Product;
export type ProductDetailResponse = Static<typeof ProductDetailResponse>;

export const PlaceOrderResponse = Order;
export type PlaceOrderResponse = Static<typeof PlaceOrderResponse>;

export const OrderDetailResponse = Order;
export type OrderDetailResponse = Static<typeof OrderDetailResponse>;

// ── Route Param Schemas ───────────────────────────────────

export const CartIdParam = Type.Object({
  cartId: Type.String(),
});

export const CartIdAndProductIdParam = Type.Object({
  cartId: Type.String(),
  productId: Type.String(),
});

export const OrderIdParam = Type.Object({
  orderId: Type.String(),
});

export const ProductIdParam = Type.Object({
  id: Type.String(),
});
