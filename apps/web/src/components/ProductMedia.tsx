import type { Product, ProductWithVariants } from '@shop/contracts/products';

import { BagArtwork } from '@/components/BagArtwork';

interface ProductMediaProps {
  product: Product | ProductWithVariants;
  className?: string;
}

function genericArtworkDataUri(name: string): string {
  const label = name.replace(/[<&>]/g, '');
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 720"><rect width="720" height="720" fill="#f3efe7"/><rect x="150" y="120" width="420" height="500" rx="24" fill="#e7e0d2" stroke="#333530" stroke-width="8"/><text x="360" y="350" text-anchor="middle" font-family="Arial,sans-serif" font-size="34" font-weight="700" fill="#292b29">${label}</text><text x="360" y="398" text-anchor="middle" font-family="Arial,sans-serif" font-size="20" fill="#69665e">PACKAGING UNAVAILABLE</text></svg>`,
  )}`;
}

export function ProductMedia({ product, className }: ProductMediaProps) {
  if (product.packaging) {
    return (
      <BagArtwork
        name={product.name}
        category={product.category}
        quantity={product.packaging.quantity}
        batchCode={product.packaging.batchCode}
        mark={product.packaging.mark}
        accent={product.packaging.labelColor}
        powderAccent={product.packaging.powderColor}
        consumptionLabel={product.packaging.consumptionLabel}
        ariaLabel={`${product.name} powder bag`}
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
