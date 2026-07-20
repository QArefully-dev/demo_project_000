import type {
  PowderMixBagSizeGrams,
  PowderMixBagColourScheme,
  PowderMixFineness,
  PowderMixPriceVersion,
} from '@shop/contracts/powderizer';

export type PowderMixDomainErrorCode =
  | 'MIX_COMPONENT_COUNT'
  | 'MIX_DUPLICATE_COMPONENT'
  | 'MIX_COMPONENT_INELIGIBLE'
  | 'MIX_PERCENTAGE_INVALID'
  | 'MIX_PERCENTAGE_TOTAL'
  | 'MIX_BAG_SIZE_INVALID'
  | 'MIX_FINENESS_INVALID'
  | 'MIX_BAG_COLOUR_INVALID'
  | 'MIX_LABEL_INVALID'
  | 'MIX_REQUOTE_REQUIRED'
  | 'MIX_STOCK_UNAVAILABLE';

export class PowderMixDomainError extends Error {
  readonly name = 'PowderMixDomainError';

  constructor(
    readonly code: PowderMixDomainErrorCode,
    message: string,
    readonly field?: string,
  ) {
    super(message);
  }
}

export interface PowderMixProduct {
  id: number;
  name: string;
  priceCents: number;
  mixable: boolean;
  mixUnitGrams: number | null;
  consumptionWarning?: 'Not for consumption' | null;
  mixingGroup: string | null;
  blendSourceVariantId: number | null;
  detailsJson: string | null;
  sourceVariantPriceCents: number | null;
  sourceVariantMixUnitGrams: number | null;
}

export interface CombinedPowderMixFacts {
  ingredients: string[];
  allergens: string[];
  intendedUse: string[];
  safety: string[];
}

export interface PowderMixComponent {
  productId: number;
  percentage: number;
}

export interface NormalizedPowderMixConfig {
  components: readonly PowderMixComponent[];
  bagSizeGrams: PowderMixBagSizeGrams;
  fineness: PowderMixFineness;
  customLabel: string | null;
  bagColourScheme: PowderMixBagColourScheme;
}

export interface PowderMixAllocation extends PowderMixComponent {
  allocatedGrams: number;
}

export interface PowderMixPrice {
  priceVersion: PowderMixPriceVersion;
  packagingFeeCents: number;
  finenessSurchargeCents: number;
  unitPriceCents: number;
}

export interface PowderMixQuote extends PowderMixPrice {
  config: NormalizedPowderMixConfig;
  allocations: readonly PowderMixAllocation[];
  usageLabel: 'Consumable powder' | 'Not for consumption';
  combinedFacts: CombinedPowderMixFacts;
}

export interface PowderMixStockLine {
  allocations: readonly Pick<PowderMixAllocation, 'productId' | 'allocatedGrams'>[];
  quantity: number;
}

export interface PowderMixStockRequirement {
  productId: number;
  bagEquivalents: number;
}
