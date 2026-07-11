import { useSearchParams } from 'react-router-dom';
import { useProducts } from '@/hooks/useProducts';
import { useCartContext } from '@/hooks/CartContext';
import { ProductGrid } from '@/components/ProductGrid';
import { ProductCard } from '@/components/ProductCard';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorMessage } from '@/components/ErrorMessage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, SlidersHorizontal } from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import type { ProductQuery } from '@shop/contracts';

const SORT_OPTIONS: { value: ProductQuery['sort']; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'bestselling', label: 'Best Selling' },
];

const PAGE_SIZES = [12, 24, 48];

function useCatalogParams() {
  const [searchParams, setSearchParams] = useSearchParams();

  const q = searchParams.get('q') ?? undefined;
  const category = searchParams.get('category') ?? undefined;
  const onSale = searchParams.has('onSale') ? searchParams.get('onSale') === 'true' : undefined;
  const sortParam = searchParams.get('sort') as ProductQuery['sort'] | null;
  const sort = (SORT_OPTIONS.some((o) => o.value === sortParam) ? sortParam : undefined) as
    ProductQuery['sort'] | undefined;
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const pageSize = PAGE_SIZES.includes(Number(searchParams.get('pageSize')))
    ? Number(searchParams.get('pageSize'))
    : 12;

  const setParam = useCallback(
    (key: string, value: string | null) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (value === null) {
          next.delete(key);
        } else {
          next.set(key, value);
        }
        // Reset page when filters change (except when setting page itself)
        if (key !== 'page' && next.has('page') && key !== 'pageSize') {
          next.set('page', '1');
        }
        return next;
      });
    },
    [setSearchParams],
  );

  return { q, category, onSale, sort, page, pageSize, setParam };
}

export function CatalogPage() {
  const { q, category, onSale, sort, page, pageSize, setParam } = useCatalogParams();

  const { products, isLoading, error, total, refetch } = useProducts({
    q,
    category,
    onSale,
    sort,
    page,
    pageSize,
  });

  const {
    error: cartError,
    addItem,
    retryCart,
    isCartAvailable,
    isActionPending,
  } = useCartContext();

  // Local search state with debounce
  const [localQ, setLocalQ] = useState(q ?? '');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    setLocalQ(q ?? '');
  }, [q]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalQ(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (mountedRef.current) setParam('q', value || null);
    }, 300);
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const activeCategory = category;
  const activeSort = sort ?? 'newest';

  if (isLoading && products.length === 0) return <LoadingSpinner />;
  if (error && products.length === 0)
    return <ErrorMessage message={error} onRetry={() => void refetch()} />;

  return (
    <div>
      {/* Header with title */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">
          Catalog{activeCategory ? ` — ${activeCategory}` : ''}
          {q ? ` — "${q}"` : ''}
        </h1>
      </div>

      {/* Toolbar: search, sort, sale filter */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search products..."
            className="pl-9"
            value={localQ}
            onChange={handleSearchChange}
          />
        </div>

        {/* Sort */}
        <select
          className="rounded-md border bg-background px-3 py-2 text-sm"
          value={activeSort}
          onChange={(e) => setParam('sort', e.target.value === 'newest' ? null : e.target.value)}
          aria-label="Sort products"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* Sale toggle */}
        <Button
          variant={onSale ? 'default' : 'outline'}
          size="sm"
          onClick={() => setParam('onSale', onSale ? null : 'true')}
        >
          <SlidersHorizontal className="mr-2 size-4" />
          On Sale
        </Button>

        {/* Active filters */}
        <div className="flex flex-wrap gap-1">
          {activeCategory && (
            <Badge
              variant="secondary"
              className="cursor-pointer"
              onClick={() => setParam('category', null)}
            >
              {activeCategory} ✕
            </Badge>
          )}
          {q && (
            <Badge
              variant="secondary"
              className="cursor-pointer"
              onClick={() => setParam('q', null)}
            >
              "{q}" ✕
            </Badge>
          )}
        </div>
      </div>

      {/* Cart error banner */}
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

      {/* Product grid or empty state */}
      {isLoading && products.length === 0 ? (
        <LoadingSpinner />
      ) : products.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">
          {q || activeCategory || onSale
            ? 'No products match your filters. Try adjusting your search.'
            : 'No products available.'}
        </p>
      ) : (
        <>
          <p className="mb-4 text-sm text-muted-foreground">
            Showing {products.length} of {total} products
            {(q || activeCategory || onSale) && ' (filtered)'}
          </p>
          <ProductGrid>
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                isCartAvailable={isCartAvailable}
                isAdding={isActionPending(product.id, 'add')}
                onAddToCart={(pid) => addItem(pid)}
              />
            ))}
          </ProductGrid>
        </>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setParam('page', String(page - 1))}
          >
            Previous
          </Button>
          <span className="px-3 text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setParam('page', String(page + 1))}
          >
            Next
          </Button>

          {/* Page size selector */}
          <div className="ml-4 flex items-center gap-2">
            <label className="text-sm text-muted-foreground">Per page:</label>
            <select
              className="rounded-md border bg-background px-2 py-1 text-sm"
              value={pageSize}
              onChange={(e) => setParam('pageSize', e.target.value)}
              aria-label="Products per page"
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
