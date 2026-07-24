import type { Product, ProductWithVariants } from '@shop/contracts/products';

import { PackagingArtwork } from '@/components/packaging/PackagingArtwork';
import { resolvePackagingSpec, type Vessel } from '@/components/packaging/packagingSpec';

interface ProductMediaProps {
  product: Product | ProductWithVariants;
  className?: string;
}

const VESSEL_LABEL: Readonly<Record<Vessel, string>> = {
  'kraft-sack': 'stitched kraft sack',
  'woven-sack': 'woven sack',
  keg: 'keg',
  'food-bag': 'bag',
};

function genericArtworkDataUri(name: string): string {
  const label = name.replace(/[<&>]/g, '');
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 720"><rect width="720" height="720" fill="#f3efe7"/><rect x="150" y="120" width="420" height="500" rx="24" fill="#e7e0d2" stroke="#333530" stroke-width="8"/><text x="360" y="350" text-anchor="middle" font-family="Arial,sans-serif" font-size="34" font-weight="700" fill="#292b29">${label}</text><text x="360" y="398" text-anchor="middle" font-family="Arial,sans-serif" font-size="20" fill="#69665e">PACKAGING UNAVAILABLE</text></svg>`,
  )}`;
}

/**
 * Renders the packaging vessel appropriate to a product's catalog category. Food-grade products
 * with `product.packaging` on the wire keep the locked live bag (colours, mark and consumption
 * badge sourced from that field); non-food categories resolve one of the approved heavy-duty
 * vessels via {@link resolvePackagingSpec}. Only a product whose category resolves to no vessel
 * and carries no `packaging` falls back to the generic "packaging unavailable" placeholder.
 */
export function ProductMedia({ product, className }: ProductMediaProps) {
  const defaultVariant =
    'variants' in product
      ? product.variants.find((variant) => variant.variantId === product.defaultVariantId)
      : undefined;
  const spec = resolvePackagingSpec({ product, variant: defaultVariant });

  if (product.packaging) {
    return (
      <PackagingArtwork
        name={product.name}
        spec={{ ...spec, vessel: 'food-bag' }}
        mark={product.packaging.mark}
        quantity={product.packaging.quantity}
        batchCode={product.packaging.batchCode}
        accent={product.packaging.labelColor}
        powderAccent={product.packaging.powderColor}
        consumptionLabel={product.packaging.consumptionLabel}
        ariaLabel={`${product.name} ${VESSEL_LABEL['food-bag']}`}
        className={className}
      />
    );
  }

  if (spec.vessel !== 'food-bag') {
    return (
      <PackagingArtwork
        name={product.name}
        spec={spec}
        mark=""
        consumptionLabel={null}
        ariaLabel={`${product.name} ${VESSEL_LABEL[spec.vessel]}`}
        className={className}
      />
    );
  }

  return (
    <img
      src={genericArtworkDataUri(product.name)}
      alt={product.name}
      width="720"
      height="720"
      className={className}
    />
  );
}
