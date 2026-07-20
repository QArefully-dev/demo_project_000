import { Type, type Static } from '@sinclair/typebox';
import { MoneyCents, PositiveIntegerString, Uuid } from './common.js';
import { PowderMixComponentInput } from './powderizer.js';
import { DeliverySummary } from './delivery.js';

export const CustomPowderConfigRequest = Type.Object(
  {
    components: Type.Array(PowderMixComponentInput, { minItems: 2, maxItems: 5 }),
    bagSizeGrams: Type.Union([Type.Literal(250), Type.Literal(500), Type.Literal(1000)]),
    fineness: Type.Union([Type.Literal('coarse'), Type.Literal('standard'), Type.Literal('fine')]),
    customLabel: Type.Optional(Type.String({ maxLength: 160 })),
    bagColourScheme: Type.Optional(
      Type.Union([
        Type.Literal('ultraviolet-cyan'),
        Type.Literal('solar-flare'),
        Type.Literal('deep-space'),
        Type.Literal('acid-lilac'),
        Type.Literal('monochrome-glitch'),
      ]),
    ),
  },
  { additionalProperties: false },
);
export type CustomPowderConfigRequest = Static<typeof CustomPowderConfigRequest>;

export const CustomPowderQuote = Type.Object(
  {
    mixId: Uuid,
    config: CustomPowderConfigRequest,
    unitPriceCents: MoneyCents,
    packagingFeeCents: MoneyCents,
    finenessSurchargeCents: MoneyCents,
    deliveryClass: Type.Union([Type.Literal('parcel'), Type.Literal('freight')]),
    usageLabel: Type.Union([
      Type.Literal('Consumable powder'),
      Type.Literal('Not for consumption'),
    ]),
    priceVersion: Type.Literal('powderizer-v1'),
  },
  { additionalProperties: false },
);
export type CustomPowderQuote = Static<typeof CustomPowderQuote>;

export const CustomPowderLine = Type.Object(
  {
    mixId: Uuid,
    components: Type.Array(PowderMixComponentInput, { minItems: 2, maxItems: 5 }),
    sourceVariantIds: Type.Array(Type.Integer({ minimum: 1 }), { minItems: 2, maxItems: 5 }),
    bagSizeGrams: Type.Union([Type.Literal(250), Type.Literal(500), Type.Literal(1000)]),
    fineness: Type.Union([Type.Literal('coarse'), Type.Literal('standard'), Type.Literal('fine')]),
    customLabel: Type.Union([Type.String({ maxLength: 160 }), Type.Null()]),
    bagColourScheme: Type.Union([
      Type.Literal('ultraviolet-cyan'),
      Type.Literal('solar-flare'),
      Type.Literal('deep-space'),
      Type.Literal('acid-lilac'),
      Type.Literal('monochrome-glitch'),
    ]),
    unitPriceCents: MoneyCents,
    quantity: Type.Integer({ minimum: 1 }),
    lineTotalCents: MoneyCents,
    deliverySummary: Type.Optional(DeliverySummary),
  },
  { additionalProperties: false },
);
export type CustomPowderLine = Static<typeof CustomPowderLine>;

export const CustomPowderQuoteRequest = Type.Object(
  {
    config: CustomPowderConfigRequest,
    quantity: Type.Integer({ minimum: 1 }),
  },
  { additionalProperties: false },
);
export type CustomPowderQuoteRequest = Static<typeof CustomPowderQuoteRequest>;

export const CustomPowderQuoteResponse = Type.Object(
  {
    quote: CustomPowderQuote,
    deliverySummary: DeliverySummary,
  },
  { additionalProperties: false },
);
export type CustomPowderQuoteResponse = Static<typeof CustomPowderQuoteResponse>;

export const IncompatibleGroupError = Type.Object(
  {
    error: Type.Literal('MIXING_GROUP_MISMATCH'),
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
export type IncompatibleGroupError = Static<typeof IncompatibleGroupError>;
