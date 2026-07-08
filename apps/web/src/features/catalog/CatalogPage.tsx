import { useSearchParams } from 'react-router-dom';
import { useProducts } from '@/hooks/useProducts';
import { useCartContext } from '@/hooks/CartContext';
import { ProductGrid } from '@/components/ProductGrid';
import { ProductCard } from '@/components/ProductCard';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorMessage } from '@/components/ErrorMessage';
import { Button } from '@/components/ui/button';

export function CatalogPage() {
  const { products, isLoading, error, refetch } = useProducts();
  const [searchParams] = useSearchParams();
  const category = searchParams.get('category');
  const {
    error: cartError,
    addItem,
    retryCart,
    isCartAvailable,
    isActionPending,
  } = useCartContext();

  const filteredProducts = category ? products.filter((p) => p.category === category) : products;

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} onRetry={() => void refetch()} />;
  if (filteredProducts.length === 0)
    return <p className="py-12 text-center text-muted-foreground">No products available.</p>;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Catalog{category ? ` — ${category}` : ''}</h1>
      {cartError && (
        <div
          role="alert"
          className="mb-6 flex items-center justify-between gap-4 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3"
        >
          <p className="text-sm text-destructive">{cartError}</p>
          <Button variant="outline" size="sm" onClick={() => void retryCart()}>
            Retry Cart
          </Button>
        </div>
      )}
      <ProductGrid>
        {filteredProducts.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            isCartAvailable={isCartAvailable}
            isAdding={isActionPending(product.id, 'add')}
            onAddToCart={(pid) => addItem(pid)}
          />
        ))}
      </ProductGrid>
    </div>
  );
}
