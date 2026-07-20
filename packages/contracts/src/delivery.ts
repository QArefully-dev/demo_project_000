import { Type, type Static } from '@sinclair/typebox';

export const FREIGHT_WEIGHT_THRESHOLD_GRAMS = 100_000;
export const FREIGHT_CHARGE_CENTS = 999;
export const PARCEL_CHARGE_CENTS = 0;

export const DeliveryMode = Type.Union([Type.Literal('parcel'), Type.Literal('freight')]);
export type DeliveryMode = Static<typeof DeliveryMode>;

export const DeliveryClass = Type.Union([Type.Literal('parcel'), Type.Literal('freight')]);
export type DeliveryClass = Static<typeof DeliveryClass>;

export const DeliverySummary = Type.Object(
  {
    mode: DeliveryMode,
    chargeCents: Type.Integer({ minimum: 0 }),
    weightGrams: Type.Integer({ minimum: 0 }),
    reason: Type.String({ minLength: 1, maxLength: 500 }),
  },
  { additionalProperties: false },
);
export type DeliverySummary = Static<typeof DeliverySummary>;

export const DeliveryQuoteInputLine = Type.Object(
  {
    deliveryClass: DeliveryClass,
    unitWeightGrams: Type.Integer({ minimum: 1 }),
    quantity: Type.Integer({ minimum: 1 }),
  },
  { additionalProperties: false },
);
export type DeliveryQuoteInputLine = Static<typeof DeliveryQuoteInputLine>;

export const DeliveryQuoteInput = Type.Object(
  {
    lines: Type.Array(DeliveryQuoteInputLine),
    customMixWeightGrams: Type.Optional(Type.Integer({ minimum: 0 })),
  },
  { additionalProperties: false },
);
export type DeliveryQuoteInput = Static<typeof DeliveryQuoteInput>;
