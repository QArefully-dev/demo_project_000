import { Type, type Static } from '@sinclair/typebox';

export const SACK_WEIGHT_GRAMS = 25_000;
export const PALLET_WEIGHT_GRAMS = 1_000_000;
export const SACKS_PER_PALLET = 40;
export const MOQ_DEFAULT_SACKS = 4;

export const PriceTier = Type.Object(
  {
    minTonnes: Type.Integer({ minimum: 1 }),
    discountPct: Type.Integer({ minimum: 0, maximum: 100 }),
  },
  { additionalProperties: false },
);
export type PriceTier = Static<typeof PriceTier>;

export const TierLadder = Type.Array(PriceTier, { minItems: 1 });
export type TierLadder = Static<typeof TierLadder>;

export const TIER_LADDER = [
  { minTonnes: 1, discountPct: 0 },
  { minTonnes: 5, discountPct: 5 },
  { minTonnes: 10, discountPct: 10 },
] as const satisfies TierLadder;
