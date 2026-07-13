import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { ProductQuery } from '@shop/contracts';
import { useProducts } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { useCartContext } from '@/hooks/CartContext';
import { ProductGrid } from '@/components/ProductGrid';
import { ProductCard } from '@/components/ProductCard';
import { ErrorMessage } from '@/components/ErrorMessage';
import { Button } from '@/components/ui/button';
import { CatalogSidebar } from './CatalogSidebar';
import { CatalogToolbar } from './CatalogToolbar';

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
  const onSale = searchParams.get('onSale') === 'true' || undefined;
  const candidate = searchParams.get('sort') as ProductQuery['sort'] | null;
  const sort = SORT_OPTIONS.some((option) => option.value === candidate)
    ? (candidate ?? undefined)
    : undefined;
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const pageSizeValue = Number(searchParams.get('pageSize'));
  const pageSize = PAGE_SIZES.includes(pageSizeValue) ? pageSizeValue : 12;

  const setParam = useCallback(
    (key: string, value: string | null) =>
      setSearchParams((previous) => {
        const next = new URLSearchParams(previous);
        if (value === null) next.delete(key);
        else next.set(key, value);
        if (key !== 'page') next.delete('page');
        return next;
      }),
    [setSearchParams],
  );
  const clearFilters = useCallback(
    () =>
      setSearchParams((previous) => {
        const next = new URLSearchParams(previous);
        ['q', 'category', 'onSale', 'page'].forEach((key) => next.delete(key));
        return next;
      }),
    [setSearchParams],
  );

  return { q, category, onSale, sort, page, pageSize, setParam, clearFilters };
}

export function CatalogPage() {
  const { q, category, onSale, sort, page, pageSize, setParam, clearFilters } = useCatalogParams();
  const { categories } = useCategories();
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
  const [localQ, setLocalQ] = useState(q ?? '');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setLocalQ(q ?? ''), [q]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const updateSearch = (value: string) => {
    setLocalQ(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setParam('q', value || null), 300);
  };

  if (error && products.length === 0) {
    return <ErrorMessage message={error} onRetry={() => void refetch()} />;
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasFilters = Boolean(q || category || onSale);
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const resultSummary =
    total === 0 ? 'No products' : `${total} ${total === 1 ? 'product' : 'products'}`;
  const title = category ?? (q ? `Results for “${q}”` : 'Shop all products');

  return (
    <div className="pb-12">
      <header className="mb-7 max-w-3xl">
        <p className="section-eyebrow">The full collection</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Explore our latest arrivals, essentials, and seasonal favourites.
        </p>
      </header>
      <CatalogToolbar
        localQuery={localQ}
        onQueryChange={updateSearch}
        resultSummary={resultSummary}
        sort={sort}
        sortOptions={SORT_OPTIONS}
        onSortChange={(value) => setParam('sort', value ?? null)}
      />
      {cartError && (
        <div
          role="alert"
          className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3"
        >
          <p className="text-sm text-destructive">{cartError}</p>
          <Button variant="outline" size="sm" onClick={() => void retryCart()}>
            Retry cart
          </Button>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-8">
        <CatalogSidebar
          categories={categories}
          category={category}
          onSale={onSale}
          query={q}
          hasFilters={hasFilters}
          onCategoryChange={(value) => setParam('category', value ?? null)}
          onSaleChange={(value) => setParam('onSale', value ? 'true' : null)}
          onQueryClear={() => setParam('q', null)}
          onClearFilters={clearFilters}
        />
        <div className="min-w-0">
          {products.length === 0 && isLoading ? (
            <CatalogSkeleton />
          ) : products.length === 0 ? (
            <CatalogEmptyState hasFilters={hasFilters} onClearFilters={clearFilters} />
          ) : (
            <div className="transition-opacity" aria-busy={isLoading} aria-live="polite">
              <p className="mb-4 text-sm text-muted-foreground">
                Showing {start}–{end} of {total}
                {isLoading && <span className="ml-2">Updating results…</span>}
              </p>
              <ProductGrid className={isLoading ? 'opacity-60' : undefined}>
                {products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    isCartAvailable={isCartAvailable}
                    isAdding={isActionPending(product.id, 'add')}
                    onAddToCart={addItem}
                  />
                ))}
              </ProductGrid>
            </div>
          )}
          {totalPages > 1 && products.length > 0 && (
            <nav
              aria-label="Catalog pagination"
              className="mt-10 flex flex-wrap items-center justify-center gap-2"
            >
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
              <label htmlFor="page-size" className="ml-3 text-sm text-muted-foreground">
                Per page
              </label>
              <select
                id="page-size"
                className="rounded-md border bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={pageSize}
                onChange={(event) => setParam('pageSize', event.target.value)}
              >
                {PAGE_SIZES.map((size) => (
                  <option key={size}>{size}</option>
                ))}
              </select>
            </nav>
          )}
        </div>
      </div>
    </div>
  );
}

function CatalogEmptyState({
  hasFilters,
  onClearFilters,
}: {
  hasFilters: boolean;
  onClearFilters: () => void;
}) {
  return (
    <div className="rounded-2xl border bg-surface-raised px-6 py-16 text-center">
      <h2 className="text-xl font-semibold">No products match those filters</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        Try another search or return to the full collection.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {hasFilters && <Button onClick={onClearFilters}>Clear filters</Button>}
        <Button variant="outline" nativeButton={false} render={<Link to="/catalog" />}>
          Browse all products
        </Button>
      </div>
    </div>
  );
}

function CatalogSkeleton() {
  return (
    <ProductGrid aria-label="Loading products" aria-busy="true">
      {Array.from({ length: 8 }, (_, index) => (
        <div key={index} className="overflow-hidden rounded-xl border bg-surface-raised p-4 sm:p-5">
          <div className="aspect-4/5 animate-pulse rounded-xl bg-muted" />
          <div className="mt-4 h-3 w-1/3 animate-pulse rounded bg-muted" />
          <div className="mt-3 h-5 w-4/5 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-5 w-3/5 animate-pulse rounded bg-muted" />
          <div className="mt-6 h-8 animate-pulse rounded-lg bg-muted" />
        </div>
      ))}
    </ProductGrid>
  );
}
