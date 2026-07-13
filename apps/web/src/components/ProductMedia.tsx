import { useEffect, useState, type ImgHTMLAttributes } from 'react';
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
  const selected = resolveProductImage(product, role, imageIndex);
  const fallback = resolveProductImage(
    {
      ...product,
      imageSetId: '__missing__',
      category: '__missing__',
    },
    role,
  );
  const fetchPriorityAttribute = {
    fetchpriority: fetchPriority,
  } as unknown as ImgHTMLAttributes<HTMLImageElement>;

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
      {...fetchPriorityAttribute}
      className={className}
      onError={() => {
        setFailed(true);
        onError?.();
      }}
    />
  );
}
