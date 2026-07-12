import { useEffect, useState } from 'react';
import type { Product } from '@shop/contracts';
import { resolveProductImage, type ProductMediaRole } from '@/data/productImageSets';

interface ProductMediaProps {
  product: Product;
  imageIndex?: number;
  className?: string;
  loading?: 'eager' | 'lazy';
  fetchPriority?: 'high' | 'low' | 'auto';
  onError?: () => void;
  role?: ProductMediaRole;
}

export function ProductMedia({
  product,
  imageIndex = 0,
  className,
  loading = 'lazy',
  fetchPriority = 'auto',
  onError,
  role = 'card',
}: ProductMediaProps) {
  const [failed, setFailed] = useState(false);
  const selected = resolveProductImage(product, role);
  const fallback = resolveProductImage(
    {
      ...product,
      imageSetId: '__missing__',
      category: '__missing__',
    },
    role,
  );

  useEffect(() => {
    setFailed(false);
  }, [product.id, imageIndex, role]);

  return (
    <img
      src={failed ? fallback.src : selected.src}
      alt={(failed ? fallback.alt : selected.alt) || product.name}
      width={failed ? fallback.width : selected.width}
      height={failed ? fallback.height : selected.height}
      loading={loading}
      fetchPriority={fetchPriority}
      className={className}
      onError={() => {
        setFailed(true);
        onError?.();
      }}
    />
  );
}
