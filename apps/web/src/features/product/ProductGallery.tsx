import type { ProductWithVariants } from '@shop/contracts/products';

import { ProductMedia } from '@/components/ProductMedia';

interface ProductGalleryProps {
  product: ProductWithVariants;
}

export function ProductGallery({ product }: ProductGalleryProps) {
  return (
    <section aria-label={`${product.name} images`} className="min-w-0">
      <div className="aspect-square overflow-hidden rounded-2xl border bg-surface-soft">
        <ProductMedia product={product} className="h-full w-full object-cover" />
      </div>
    </section>
  );
}
