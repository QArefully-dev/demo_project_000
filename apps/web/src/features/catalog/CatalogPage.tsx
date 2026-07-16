import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProducts } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { useProductFilterOptions } from '@/hooks/useProductFilterOptions';
import { useCartContext } from '@/hooks/CartContext';
import { ProductGrid } from '@/components/ProductGrid';
import { ProductCard } from '@/components/ProductCard';
import { ErrorMessage } from '@/components/ErrorMessage';
import { Button } from '@/components/ui/button';
import { CatalogSidebar } from './CatalogSidebar';
import { CatalogToolbar } from './CatalogToolbar';
import { PAGE_SIZES, SORT_OPTIONS } from './catalogOptions';
import { useCatalogParams } from './useCatalogParams';

export function CatalogPage() {
  const {
    q,
    category,
    onSale,
    minPriceCents,
    maxPriceCents,
    addedFrom,
    addedTo,
    tag = [],
    spec = [],
    availability,
    sort,
    page,
    pageSize,
    setParam,
    clearFilters,
  } = useCatalogParams();
  const { categories } = useCategories();
  const {
    options: filterOptions,
    isLoading: filterOptionsLoading,
    error: filterOptionsError,
  } = useProductFilterOptions();
  const { products, isLoading, error, total, refetch } = useProducts({
    q,
    category,
    onSale,
    minPriceCents,
    maxPriceCents,
    addedFrom,
    addedTo,
    tag,
    spec,
    availability,
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
  const hasFilters = Boolean(
    q ||
      category ||
      onSale ||
      minPriceCents !== undefined ||
      maxPriceCents !== undefined ||
      addedFrom ||
      addedTo ||
      tag.length > 0 ||
      spec.length > 0 ||
      availability,
  );
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const resultSummary =
    total === 0 ? 'No powders' : `${total} ${total === 1 ? 'powder' : 'powders'}`;
  const title = category ?? (q ? `Results for “${q}”` : 'Shop all products');

  const powderTitle =
    category ??
    (q ? `Powder search results: ${q}` : title.replace('Shop all products', 'All powders'));

  return (
    <div className="pb-12">
      <header className="mb-7 max-w-3xl">
        <p className="section-eyebrow">The powder catalogue</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{powderTitle}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          From pantry staples to conceptual quantities. All powders are clearly labelled.
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
          minPriceCents={minPriceCents}
          maxPriceCents={maxPriceCents}
          addedFrom={addedFrom}
          addedTo={addedTo}
          availability={availability}
          tags={tag}
          specs={spec}
          filterOptions={filterOptions ?? undefined}
          filterOptionsLoading={filterOptionsLoading}
          filterOptionsError={filterOptionsError ?? undefined}
          hasFilters={hasFilters}
          onCategoryChange={(value) => setParam('category', value ?? null)}
          onSaleChange={(value) => setParam('onSale', value ? 'true' : null)}
          onQueryClear={() => setParam('q', null)}
          onMinPriceCentsChange={(value) =>
            setParam('minPriceCents', value === undefined ? null : String(value))
          }
          onMaxPriceCentsChange={(value) =>
            setParam('maxPriceCents', value === undefined ? null : String(value))
          }
          onAddedFromChange={(value) => setParam('addedFrom', value ?? null)}
          onAddedToChange={(value) => setParam('addedTo', value ?? null)}
          onAvailabilityChange={(value) => setParam('availability', value ?? null)}
          onTagChange={(value, selected) =>
            setParam('tag', selected ? [...tag, value] : tag.filter((item) => item !== value))
          }
          onSpecChange={(key, value) =>
            setParam(
              'spec',
              value
                ? [...spec.filter((item) => !item.startsWith(`${key}:`)), `${key}:${value}`]
                : spec.filter((item) => !item.startsWith(`${key}:`)),
            )
          }
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
      <h2 className="text-xl font-semibold">No powders match those filters</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        Try another powder, category, or return to the full catalogue.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {hasFilters && <Button onClick={onClearFilters}>Clear filters</Button>}
        <Button variant="outline" nativeButton={false} render={<Link to="/catalog" />}>
          Browse all powders
        </Button>
      </div>
    </div>
  );
}

function CatalogSkeleton() {
  return (
    <ProductGrid aria-label="Loading powders" aria-busy="true">
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
