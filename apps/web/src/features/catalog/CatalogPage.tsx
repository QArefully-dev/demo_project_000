import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import type { ProductQuery } from '@shop/contracts';
import { useProducts } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { useCartContext } from '@/hooks/CartContext';
import { ProductGrid } from '@/components/ProductGrid';
import { ProductCard } from '@/components/ProductCard';
import { ErrorMessage } from '@/components/ErrorMessage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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

  if (error && products.length === 0)
    return <ErrorMessage message={error} onRetry={() => void refetch()} />;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasFilters = Boolean(q || category || onSale);
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="pb-12">
      <header className="mb-8">
        <p className="section-eyebrow">The full collection</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          {category ?? (q ? `Results for “${q}”` : 'Shop all products')}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {total} {total === 1 ? 'product' : 'products'} found
        </p>
      </header>
      <div className="mb-7 flex flex-wrap items-center gap-3 rounded-2xl border bg-surface-raised p-3 shadow-sm">
        <div className="relative min-w-60 flex-1 lg:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            aria-label="Search within catalog"
            placeholder="Search this collection"
            className="h-10 rounded-full pl-9"
            value={localQ}
            onChange={(event) => updateSearch(event.target.value)}
          />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <label htmlFor="catalog-sort" className="text-sm font-medium text-muted-foreground">
            Sort by
          </label>
          <select
            id="catalog-sort"
            className="h-10 rounded-lg border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={sort ?? 'newest'}
            onChange={(event) =>
              setParam('sort', event.target.value === 'newest' ? null : event.target.value)
            }
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
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
      <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside aria-label="Catalog filters" className="space-y-7 lg:sticky lg:top-32 lg:self-start">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Filters</h2>
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Clear all
              </button>
            )}
          </div>
          <fieldset>
            <legend className="mb-3 text-sm font-semibold">Department</legend>
            <div className="space-y-1">
              <FilterButton active={!category} onClick={() => setParam('category', null)}>
                All departments
              </FilterButton>
              {categories.map((item) => (
                <FilterButton
                  key={item}
                  active={category === item}
                  onClick={() => setParam('category', item)}
                >
                  {item}
                </FilterButton>
              ))}
            </div>
          </fieldset>
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border bg-surface-raised p-3 text-sm font-medium">
            <input
              type="checkbox"
              checked={onSale === true}
              onChange={() => setParam('onSale', onSale ? null : 'true')}
              className="size-4 accent-primary"
            />{' '}
            On sale now
          </label>
          {hasFilters && (
            <div className="flex flex-wrap gap-2">
              {q && <FilterChip onClick={() => setParam('q', null)}>“{q}”</FilterChip>}
              {category && (
                <FilterChip onClick={() => setParam('category', null)}>{category}</FilterChip>
              )}
            </div>
          )}
        </aside>
        <div className="min-w-0">
          {products.length === 0 && isLoading ? (
            <CatalogSkeleton />
          ) : products.length === 0 ? (
            <div className="rounded-2xl border bg-surface-raised px-6 py-16 text-center">
              <h2 className="text-xl font-semibold">No products match those filters</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Try another search or clear your filters to see the full collection.
              </p>
              <Button className="mt-6" onClick={clearFilters}>
                Clear filters
              </Button>
            </div>
          ) : (
            <div
              className={isLoading ? 'opacity-60 transition-opacity' : 'transition-opacity'}
              aria-busy={isLoading}
            >
              <p className="mb-4 text-sm text-muted-foreground">
                Showing {start}–{end} of {total}
              </p>
              <ProductGrid>
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
                className="rounded-md border bg-background px-2 py-1 text-sm"
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

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`block w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${active ? 'bg-accent font-semibold text-accent-foreground' : 'hover:bg-muted'}`}
    >
      {children}
    </button>
  );
}
function FilterChip({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium"
    >
      {children}
      <X className="size-3" />
    </button>
  );
}
function CatalogSkeleton() {
  return (
    <div aria-label="Loading products" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: 8 }, (_, index) => (
        <div key={index} className="animate-pulse">
          <div className="aspect-square rounded-2xl bg-muted" />
          <div className="mt-3 h-4 w-3/4 rounded bg-muted" />
          <div className="mt-2 h-4 w-1/2 rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}
