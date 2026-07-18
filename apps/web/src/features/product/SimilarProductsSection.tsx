import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Product } from '@shop/contracts/products';
import { getSimilarProducts } from '@/api/products';
import { ProductCard } from '@/components/ProductCard';
import { ProductGrid } from '@/components/ProductGrid';

interface SimilarProductsSectionProps {
  productId: string;
  isCartAvailable: boolean;
  isAdding: (productId: string) => boolean;
  onAddToCart: (productId: string) => Promise<boolean>;
}

/**
 * An independently loaded shelf. Its network state deliberately never affects
 * the product detail or purchase controls above it.
 */
export function SimilarProductsSection({
  productId,
  isCartAvailable,
  isAdding,
  onAddToCart,
}: SimilarProductsSectionProps) {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requestVersion, setRequestVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let current = true;

    setProducts(null);
    setError(null);

    getSimilarProducts(productId, controller.signal)
      .then((response) => {
        if (!current) return;
        setProducts(Array.isArray(response) ? response.slice(0, 5) : []);
      })
      .catch((loadError: unknown) => {
        if (!current || controller.signal.aborted) return;
        setError(
          loadError instanceof Error ? loadError.message : 'Could not load similar powders.',
        );
      });

    return () => {
      current = false;
      controller.abort();
    };
  }, [productId, requestVersion]);

  if (products === null && error === null) {
    return (
      <section className="mt-16" aria-label="Similar powders" aria-busy="true">
        <p className="text-sm text-muted-foreground">Finding similar powders...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="mt-16" aria-label="Similar powders">
        <p role="alert" className="text-sm text-muted-foreground">
          Could not load similar powders.
        </p>
        <button
          type="button"
          className="mt-2 rounded-sm text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => setRequestVersion((version) => version + 1)}
        >
          Try again
        </button>
      </section>
    );
  }

  if (!products || products.length === 0) return null;

  return (
    <section className="mt-16" aria-labelledby="similar-products-heading">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="section-eyebrow">Chosen for their shared traits</p>
          <h2 id="similar-products-heading" className="section-heading mt-2">
            Similar powders
          </h2>
        </div>
        <Link to="/catalog" className="section-link">
          Browse all powders
        </Link>
      </div>
      <ProductGrid>
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            isCartAvailable={isCartAvailable}
            isAdding={isAdding(product.id)}
            onAddToCart={onAddToCart}
          />
        ))}
      </ProductGrid>
    </section>
  );
}
