import { useEffect, useRef, useState } from 'react';
import type { Product } from '@shop/contracts';
import { ProductMedia } from '@/components/ProductMedia';
import { resolveProductImages } from '@/data/productImageSets';
import { cn } from '@/lib/utils';

interface ProductGalleryProps {
  product: Product;
}

export function ProductGallery({ product }: ProductGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const thumbnailRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const images = resolveProductImages(product);

  useEffect(() => {
    setSelectedIndex(0);
  }, [product.id]);

  const selectImage = (index: number, shouldFocus = false) => {
    setSelectedIndex(index);
    if (shouldFocus) thumbnailRefs.current[index]?.focus();
  };

  const handleThumbnailKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % images.length;
    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + images.length) % images.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = images.length - 1;
    if (nextIndex == null) return;

    event.preventDefault();
    selectImage(nextIndex, true);
  };

  return (
    <section aria-label={`${product.name} images`} className="min-w-0">
      <div className="aspect-square overflow-hidden rounded-2xl border bg-surface-soft">
        <ProductMedia
          product={product}
          imageIndex={selectedIndex}
          className="h-full w-full object-cover"
          loading="eager"
          fetchPriority="high"
          role="detail"
        />
      </div>

      {images.length > 1 && (
        <div className="mt-4 flex gap-3 overflow-x-auto pb-1" aria-label="Choose product image">
          {images.map((image, index) => (
            <button
              key={`${image.src}-${index}`}
              type="button"
              ref={(element) => {
                thumbnailRefs.current[index] = element;
              }}
              aria-label={`View image ${index + 1} of ${images.length}`}
              aria-pressed={selectedIndex === index}
              onClick={() => selectImage(index)}
              onKeyDown={(event) => handleThumbnailKeyDown(event, index)}
              className={cn(
                'size-20 shrink-0 overflow-hidden rounded-xl border-2 bg-surface-soft transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                selectedIndex === index
                  ? 'border-primary'
                  : 'border-transparent hover:border-border',
              )}
            >
              <ProductMedia
                product={product}
                imageIndex={index}
                className="h-full w-full object-cover"
                role="thumbnail"
              />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
