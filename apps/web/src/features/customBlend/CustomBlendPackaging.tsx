import type { CatalogVariant } from '@shop/contracts/products';
import type { CustomBlendSnapshot } from '@shop/contracts/custom-blends';

import { PackagingArtwork } from '@/components/packaging/PackagingArtwork';
import {
  resolvePackagingSpec,
  type PackagingProductInput,
  type Vessel,
} from '@/components/packaging/packagingSpec';

/**
 * Stable diagnostic key for the one Custom Blend livery. A blend is never printed from a catalog
 * colour scheme, so this key is fixed rather than resolved per product.
 */
export const CUSTOM_BLEND_SCHEME_KEY = 'custom-blend';

/**
 * Fixed charcoal decoration. Deliberately constant: composition must not be readable from the
 * vessel, so no ingredient, percentage or mixing group may reach a colour here.
 */
export const CUSTOM_BLEND_PIGMENT = '#3a3d39';
export const CUSTOM_BLEND_INK = '#1e211d';

/** Printed spec band. Identifies the line as configured without naming its composition. */
const CUSTOM_BLEND_SPEC_BAND = 'CUSTOM BLEND';

/**
 * Shared disclosure copy, so cart, checkout and order detail cannot drift apart.
 *
 * Non-returnability and cancellation are separate rules and must not be conflated: the backend
 * excludes blend lines from returns (`custom_blend_json IS NULL` in the return-eligibility query)
 * but applies no blend-specific cancellation rule, so an order holding a blend cancels on the
 * ordinary schedule.
 */
export const CUSTOM_BLEND_MADE_TO_ORDER_NOTE =
  'Made to order. Custom blends cannot be returned, but you can still cancel the order until it is dispatched.';

const VESSEL_LABEL: Readonly<Record<Vessel, string>> = {
  'kraft-sack': 'stitched kraft sack',
  'woven-sack': 'woven sack',
  keg: 'keg',
  'food-bag': 'bag',
};

/**
 * Batch marking derived from the config key. The key is already a canonical hash of the
 * specification, so equal blends mark identically and different blends mark differently without
 * the mark itself disclosing any ingredient.
 */
export function customBlendBatchMark(configKey: string): string {
  return `CB-${configKey.slice(0, 6).toUpperCase()}`;
}

/**
 * Human-readable composition, e.g. `Portland Cement — 30% Chalk Filler, 10% Silica Flour`.
 * Ingredient order follows the snapshot, which the server already canonicalises.
 */
export function customBlendCompositionLabel(
  baseProductName: string,
  blend: CustomBlendSnapshot,
): string {
  const ingredients = blend.ingredients
    .map((ingredient) => `${ingredient.percentage}% ${ingredient.productName}`)
    .join(', ');
  return `${blend.basePercentage}% ${baseProductName} — ${ingredients}`;
}

interface CustomBlendPackagingProps {
  product: PackagingProductInput;
  variant?: Pick<CatalogVariant, 'sku' | 'label'>;
  blend: CustomBlendSnapshot;
  /** Draft previews have no server config key; their mark must never claim one. */
  previewBatchMark?: string;
  className?: string;
}

/**
 * Custom Blend livery. The base product's category alone selects the vessel shape (via the shared
 * resolver), then the decoration is replaced wholesale by the fixed charcoal scheme, the spec band
 * and the config-key batch mark. Safety ink (`alert`) stays category-owned, so a hazard treatment
 * is never softened by the blend livery.
 *
 * Unlike `ProductMedia`, no catalog palette gate applies: the livery is not a catalog scheme, so a
 * base product without a resolved palette still prints its vessel rather than the generic
 * placeholder.
 */
export function CustomBlendPackaging({
  product,
  variant,
  blend,
  previewBatchMark,
  className,
}: CustomBlendPackagingProps) {
  // Orders written before base presentation was frozen cannot safely infer a vessel. In
  // particular, the shared resolver's unknown-category fallback is a food bag, which would make
  // an historic non-food blend misleading. Show a neutral, explicit placeholder instead.
  if (!product.category) {
    return (
      <span
        role="img"
        aria-label={`${product.name} custom blend packaging unavailable`}
        className={className}
        data-testid="custom-blend-livery"
        data-vessel="neutral"
        data-colour-scheme="neutral"
      >
        Custom blend
      </span>
    );
  }
  const baseSpec = resolvePackagingSpec({ product, variant });
  const mark = previewBatchMark ?? customBlendBatchMark(blend.configKey);
  const spec = {
    ...baseSpec,
    schemeKey: CUSTOM_BLEND_SCHEME_KEY,
    pigment: CUSTOM_BLEND_PIGMENT,
    ink: { ink: CUSTOM_BLEND_INK, alert: baseSpec.ink.alert },
    grade: baseSpec.grade ?? CUSTOM_BLEND_SPEC_BAND,
    lot: mark,
  };

  return (
    // `display: contents` keeps the diagnostic attributes queryable without adding a box that
    // would change how the vessel sizes inside its existing containers.
    <span
      className="contents"
      data-testid="custom-blend-livery"
      data-vessel={spec.vessel}
      data-colour-scheme={CUSTOM_BLEND_SCHEME_KEY}
      // Read from the resolved spec, not the constants, so any composition-derived colour would be
      // observable here instead of hiding behind a literal that cannot vary.
      data-pigment={spec.pigment}
      data-ink={spec.ink.ink}
      data-batch-mark={mark}
    >
      <PackagingArtwork
        name={product.name}
        spec={spec}
        mark="CB"
        // The food-bag renderer has no grade slot; its printed quantity line is the equivalent
        // short label. Pass the resolved grade through so its `CUSTOM BLEND` fallback is visible.
        quantity={spec.grade}
        batchCode={mark}
        schemeKey={CUSTOM_BLEND_SCHEME_KEY}
        consumptionLabel={null}
        ariaLabel={`${product.name} custom blend ${VESSEL_LABEL[spec.vessel]}`}
        className={className}
      />
    </span>
  );
}
