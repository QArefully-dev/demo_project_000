import { Type, type Static } from '@sinclair/typebox';

/** Monetary value in cents. Safe integer >= 0. */
export const MoneyCents = Type.Integer({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER });

export const ErrorResponse = Type.Object({
  error: Type.String({ minLength: 1, maxLength: 500 }),
  details: Type.Optional(Type.Unknown()),
});
export type ErrorResponse = Static<typeof ErrorResponse>;

export const SuccessResponse = Type.Object({
  success: Type.Literal(true),
});
export type SuccessResponse = Static<typeof SuccessResponse>;

/** Bounded email accepted by transport. Domain normalizes it separately. */
export const EmailAddress = Type.String({
  minLength: 3,
  maxLength: 254,
  pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$',
});

export const Password = Type.String({ minLength: 8, maxLength: 128 });

/** Decimal route parameter for a positive database identifier. */
export const PositiveIntegerString = Type.String({ pattern: '^[1-9][0-9]*$' });

/** UUID v4-compatible transport identifier. */
export const Uuid = Type.String({
  pattern:
    '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$',
});

export const CustomerName = Type.String({ minLength: 1, maxLength: 120 });
export const ShippingAddress = Type.String({ minLength: 5, maxLength: 500 });
export const PromoCodeValue = Type.String({ minLength: 1, maxLength: 64 });
