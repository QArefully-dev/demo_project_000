import { useParams, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getProduct, getRelatedProducts } from '@/api/products';
import { useCartContext } from '@/hooks/CartContext';
import { ProductGrid } from '@/components/ProductGrid';
import { ProductCard } from '@/components/ProductCard';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorMessage } from '@/components/ErrorMessage';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { WishlistButton } from '@/components/WishlistButton';
import { formatMoney } from '@/lib/formatMoney';
import type { Product } from '@shop/contracts';

export function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);

  const {
    error: cartError,
    addItem,
    retryCart,
    isCartAvailable,
    isActionPending,
  } = useCartContext();

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    Promise.all([getProduct(id).catch(() => null), getRelatedProducts(id).catch(() => [])])
      .then(([productResult, relatedResult]) => {
        if (cancelled) return;
        if (!productResult) {
          setError('Product not found');
        } else {
          setProduct(productResult);
          setRelated(Array.isArray(relatedResult) ? relatedResult : []);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load product');
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

  const inStock = product.stock > 0;
  const isOnSale =
    product.compareAtPriceCents != null && product.compareAtPriceCents > product.priceCents;
  const isBestseller = product.salesCount >= 250;
  const [actionError, setActionError] = useState<string | null>(null);

  const handleAddToCart = async () => {
    setActionError(null);
    const added = await addItem(product.id);
    if (!added) setActionError('Could not add this item. Try again.');
  };

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="mb-4 text-sm text-muted-foreground">
        <Link to="/catalog" className="hover:text-foreground">
          Catalog
        </Link>
        <span className="mx-2">/</span>
        <span>{product.name}</span>
      </nav>

      {/* Product detail */}
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Image */}
        <div className="aspect-square bg-muted rounded-lg flex items-center justify-center overflow-hidden">
          {imgError ? (
            <span className="text-muted-foreground text-lg">No image available</span>
          ) : (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="h-full w-full object-cover"
              onError={() => setImgError(true)}
            />
          )}
        </div>

        {/* Info */}
        <div className="flex flex-col gap-4">
          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            {isOnSale && <Badge variant="destructive">Sale</Badge>}
            {isBestseller && (
              <Badge className="bg-amber-100 text-amber-800 border-amber-200">Bestseller</Badge>
            )}
            <Badge variant="secondary">{product.category}</Badge>
          </div>

          <h1 className="text-3xl font-bold">{product.name}</h1>

          {/* Price */}
          <div className="flex items-baseline gap-3">
            {isOnSale ? (
              <>
                <span className="text-2xl font-bold text-destructive">
                  {formatMoney(product.priceCents)}
                </span>
                <span className="text-lg text-muted-foreground line-through">
                  {formatMoney(product.compareAtPriceCents!)}
                </span>
              </>
            ) : (
              <span className="text-2xl font-bold">{formatMoney(product.priceCents)}</span>
            )}
          </div>

          {/* Stock */}
          <div className="flex items-center gap-2">
            <span
              className={`inline-block h-2 w-2 rounded-full ${inStock ? 'bg-green-500' : 'bg-destructive'}`}
            />
            <span className={`text-sm ${inStock ? 'text-green-600' : 'text-destructive'}`}>
              {inStock ? `In Stock (${product.stock} available)` : 'Out of Stock'}
            </span>
          </div>

          {/* Description */}
          <p className="text-muted-foreground">{product.description}</p>

          {/* Sales count */}
          {product.salesCount > 0 && (
            <p className="text-sm text-muted-foreground">{product.salesCount} sold</p>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-3 pt-2">
            <Button
              size="lg"
              className="w-full sm:w-auto"
              disabled={!isCartAvailable || !inStock || isActionPending(product.id, 'add')}
              onClick={() => {
                void handleAddToCart();
              }}
            >
              {!isCartAvailable
                ? 'Cart Unavailable'
                : isActionPending(product.id, 'add')
                  ? 'Adding...'
                  : inStock
                    ? 'Add to Cart'
                    : 'Unavailable'}
            </Button>

            {/* WishlistButton seam (inactive placeholder) */}
            <WishlistButton />

            {actionError && (
              <p role="alert" className="text-sm text-destructive">
                {actionError}
              </p>
            )}
            {cartError && (
              <div role="alert" className="flex items-center gap-2">
                <p className="text-sm text-destructive">{cartError}</p>
                <Button variant="outline" size="sm" onClick={() => void retryCart()}>
                  Retry Cart
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Related products */}
      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-6 text-xl font-bold">Related Products</h2>
          <ProductGrid>
            {related.map((relatedProduct) => (
              <ProductCard
                key={relatedProduct.id}
                product={relatedProduct}
                isCartAvailable={isCartAvailable}
                isAdding={isActionPending(relatedProduct.id, 'add')}
                onAddToCart={(pid) => addItem(pid)}
              />
            ))}
          </ProductGrid>
        </section>
      )}
    </div>
  );
}
