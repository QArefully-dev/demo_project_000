import { useEffect, useState, type ImgHTMLAttributes } from 'react';
import type { Product } from '@shop/contracts';
import { getProductVisual } from '@shop/contracts';
import { resolveProductImage, type ProductMediaRole } from '@/data/productImageSets';
import { BagArtwork } from '@/components/BagArtwork';

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
  const visual = getProductVisual(product.imageSetId);
  const selected = resolveProductImage(product, role, imageIndex);
  const fallback = resolveProductImage(
    {
      ...product,
      imageSetId: '__missing__',
      category: '__missing__',
      images: [],
    },
    role,
  );
  const fetchPriorityAttribute = {
    fetchpriority: fetchPriority,
  } as unknown as ImgHTMLAttributes<HTMLImageElement>;

  useEffect(() => {
    setFailed(false);
  }, [product.id, imageIndex, role]);

  if (visual) {
    const quantity =
      product.description.match(/(?:\d+(?:\.\d+)?\s?(?:g|kg)|conceptual quantity)/i)?.[0] ??
      'Measured quantity';
    return (
      <BagArtwork
        shape="paper-square"
        decoration="paired-ovals"
        name={product.name}
        category={product.category}
        quantity={quantity}
        batchCode={visual.batchCode}
        mark={visual.mark}
        accent={visual.labelColor}
        powderAccent={visual.powderColor}
        ariaLabel={`${product.name} powder bag`}
        className={className}
      />
    );
  }

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
