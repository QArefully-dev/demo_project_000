import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Product } from '@shop/contracts';
import { getProduct, getRelatedProducts } from '@/api/products';
import { ErrorMessage } from '@/components/ErrorMessage';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ProductCard } from '@/components/ProductCard';
import { ProductGrid } from '@/components/ProductGrid';
import { useCartContext } from '@/hooks/CartContext';
import { ProductDetails } from './ProductDetails';
import { ProductGallery } from './ProductGallery';
import { ProductPurchasePanel } from './ProductPurchasePanel';

export function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const {
    error: cartError,
    addItem,
    retryCart,
    isCartAvailable,
    isActionPending,
  } = useCartContext();

  useEffect(() => {
    if (!id) {
      setError('Product not found');
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setProduct(null);
    setRelated([]);
    setActionError(null);

    Promise.all([getProduct(id).catch(() => null), getRelatedProducts(id).catch(() => [])])
      .then(([productResult, relatedResult]) => {
        if (cancelled) return;
        if (!productResult) setError('Product not found');
        else {
          setProduct(productResult);
          setRelated(Array.isArray(relatedResult) ? relatedResult.slice(0, 5) : []);
        }
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

  const handleAddToCart = async () => {
    setActionError(null);
    if (!(await addItem(product.id))) setActionError('Could not add this item. Try again.');
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
          Catalog
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
          cartError={cartError}
          onAddToCart={() => void handleAddToCart()}
          onRetryCart={() => void retryCart()}
        />
      </div>

      <div className="mt-12 grid gap-6">
        <ProductDetails description={product.description} />
      </div>

      {related.length > 0 && (
        <section className="mt-16" aria-labelledby="related-products-heading">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="section-eyebrow">You may also like</p>
              <h2 id="related-products-heading" className="section-heading mt-2">
                Related products
              </h2>
            </div>
            <Link
              to={`/catalog?category=${encodeURIComponent(product.category)}`}
              className="section-link"
            >
              View category
            </Link>
          </div>
          <ProductGrid>
            {related.map((relatedProduct) => (
              <ProductCard
                key={relatedProduct.id}
                product={relatedProduct}
                isCartAvailable={isCartAvailable}
                isAdding={isActionPending(relatedProduct.id, 'add')}
                onAddToCart={(productId) => addItem(productId)}
              />
            ))}
          </ProductGrid>
        </section>
      )}
    </div>
  );
}
