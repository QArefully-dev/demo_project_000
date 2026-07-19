import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Product } from '@shop/contracts/products';
import { ApiError } from '@/api/client';
import { getProduct } from '@/api/products';
import { ErrorMessage } from '@/components/ErrorMessage';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ProductBundlesSection } from '@/features/product/ProductBundlesSection';
import { useCartContext } from '@/hooks/CartContext';
import { ProductContextLinks } from './ProductContextLinks';
import { ProductDetails } from './ProductDetails';
import { ProductGallery } from './ProductGallery';
import { ProductPurchasePanel } from './ProductPurchasePanel';
import { ProductSpecifications } from './ProductSpecifications';
import { ReviewsSection } from './ReviewsSection';
import { SimilarProductsSection } from './SimilarProductsSection';

export function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const addInFlightProductIdsRef = useRef(new Set<string>());
  const activeProductIdRef = useRef<string | undefined>(id);
  const {
    addItem,
    isCartAvailable,
    isActionPending,
  } = useCartContext();

  useEffect(() => {
    let cancelled = false;
    activeProductIdRef.current = id;
    setIsLoading(true);
    setError(null);
    setProduct(null);
    setActionError(null);

    if (!id) {
      setError('Product not found');
      setIsLoading(false);
      return;
    }

    getProduct(id)
      .catch((loadError: unknown) => {
        if (loadError instanceof ApiError && loadError.status === 404) return null;
        throw loadError;
      })
      .then((productResult) => {
        if (cancelled) return;
        if (!productResult) setError('Product not found');
        else setProduct(productResult);
      })
      .catch((loadError: unknown) => {
        if (!cancelled)
          setError(loadError instanceof Error ? loadError.message : 'Failed to load product');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;
  if (!product) return <ErrorMessage message="Product not found" />;

  const handleAddToCart = async (): Promise<void> => {
    const productId = product.id;
    if (addInFlightProductIdsRef.current.has(productId)) return;
    addInFlightProductIdsRef.current.add(productId);
    setActionError(null);
    try {
      if (!(await addItem(productId)) && activeProductIdRef.current === productId) {
        setActionError('Could not add this item. Try again.');
      }
    } finally {
      addInFlightProductIdsRef.current.delete(productId);
    }
  };

  return (
    <div className="pb-8">
      <nav
        aria-label="Breadcrumb"
        className="mb-6 flex flex-wrap items-center gap-2 text-sm text-muted-foreground"
      >
        <Link
          to="/catalog"
          className="rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          All powders
        </Link>
        <span aria-hidden="true">/</span>
        <Link
          to={`/catalog?category=${encodeURIComponent(product.category)}`}
          className="rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {product.category}
        </Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page" className="text-foreground">
          {product.name}
        </span>
      </nav>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)] xl:gap-12">
        <ProductGallery product={product} />
        <ProductPurchasePanel
          product={product}
          isCartAvailable={isCartAvailable}
          isAdding={isActionPending(product.id, 'add')}
          actionError={actionError}
          onAddToCart={handleAddToCart}
        />
      </div>

      <div className="mt-12 grid gap-6">
        <ProductDetails description={product.description} />
        <ProductSpecifications specificationGroups={product.specificationGroups} />
        <ProductContextLinks packagingQuantity={product.packaging?.quantity} />
      </div>

      <ProductBundlesSection productId={product.id} />
      <ReviewsSection productId={product.id} />
      <SimilarProductsSection
        productId={product.id}
        isCartAvailable={isCartAvailable}
        isAdding={(productId) => isActionPending(productId, 'add')}
        onAddToCart={addItem}
      />
    </div>
  );
}
