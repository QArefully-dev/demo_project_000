import { useEffect, useMemo, useState } from 'react';
import type { Product } from '@shop/contracts/products';
import { Button } from '@/components/ui/button';
import { formatMoney } from '@/lib/formatMoney';

const ALL_POWDERS = 'All powders';
export const COMPONENT_PICKER_PAGE_SIZE = 8;

function categoryForInitialSelection(
  products: readonly Product[],
  selectedProductIds: readonly string[],
): string {
  const selectedCategory = products.find((product) =>
    selectedProductIds.includes(product.id),
  )?.category;
  if (selectedCategory) return selectedCategory;
  return products.some(({ category }) => category === 'Pantry Staples')
    ? 'Pantry Staples'
    : (products[0]?.category ?? ALL_POWDERS);
}

export function useComponentPicker(
  products: readonly Product[],
  selectedProductIds: readonly string[],
) {
  const categories = useMemo(
    () => [ALL_POWDERS, ...Array.from(new Set(products.map(({ category }) => category)))],
    [products],
  );
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const resolvedCategory =
    activeCategory ?? categoryForInitialSelection(products, selectedProductIds);

  useEffect(() => {
    if (!categories.includes(resolvedCategory)) {
      setActiveCategory(categoryForInitialSelection(products, selectedProductIds));
      setPage(1);
    }
  }, [categories, products, resolvedCategory, selectedProductIds]);

  const activeProducts = useMemo(
    () =>
      resolvedCategory === ALL_POWDERS
        ? [...products]
        : products.filter(({ category }) => category === resolvedCategory),
    [products, resolvedCategory],
  );
  const pageCount = Math.max(1, Math.ceil(activeProducts.length / COMPONENT_PICKER_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleProducts = activeProducts.slice(
    (currentPage - 1) * COMPONENT_PICKER_PAGE_SIZE,
    currentPage * COMPONENT_PICKER_PAGE_SIZE,
  );

  return {
    categories,
    activeCategory: resolvedCategory,
    activeProducts,
    currentPage,
    pageCount,
    visibleProducts,
    selectCategory: (category: string) => {
      setActiveCategory(category);
      setPage(1);
    },
    selectPage: setPage,
  };
}

type ComponentPickerProps = {
  selectedProductIds: readonly string[];
  onAdd: (productId: string) => void;
  picker: ReturnType<typeof useComponentPicker>;
};

export function ComponentPicker({ selectedProductIds, onAdd, picker }: ComponentPickerProps) {
  const isAtMaximum = selectedProductIds.length >= 5;
  const resultCount = picker.activeProducts.length;
  return (
    <fieldset className="rounded-xl border border-border bg-surface-raised p-4">
      <legend className="px-1 font-semibold">1. Choose powders</legend>
      <p className="mb-3 text-sm text-muted-foreground">
        Every eligible category can be mixed. Check each product's safety label before use.
      </p>
      <div className="mb-3 flex flex-wrap gap-2" aria-label="Powder categories">
        {picker.categories.map((category) => (
          <Button
            key={category}
            type="button"
            size="sm"
            variant={picker.activeCategory === category ? 'secondary' : 'outline'}
            aria-pressed={picker.activeCategory === category}
            onClick={() => picker.selectCategory(category)}
          >
            {category}
          </Button>
        ))}
      </div>
      <p className="mb-3 text-sm" aria-live="polite">
        <strong>{picker.activeCategory}</strong> · {resultCount} results · Page {picker.currentPage}{' '}
        of {picker.pageCount} · {selectedProductIds.length} of 5 powders selected
      </p>
      {picker.visibleProducts.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          No eligible powders in this category.
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {picker.visibleProducts.map((product) => {
            const selected = selectedProductIds.includes(product.id);
            return (
              <div
                key={product.id}
                className="flex min-w-0 items-center justify-between gap-3 rounded-lg border bg-background p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{product.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {product.category} · {formatMoney(product.priceCents)} source bag
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={selected ? 'secondary' : 'outline'}
                  disabled={selected || isAtMaximum}
                  onClick={() => onAdd(product.id)}
                >
                  {selected ? 'Selected' : 'Add'}
                </Button>
              </div>
            );
          })}
        </div>
      )}
      {picker.pageCount > 1 && (
        <div className="mt-4 flex items-center justify-between gap-3">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={picker.currentPage === 1}
            onClick={() => picker.selectPage(picker.currentPage - 1)}
          >
            Previous page
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={picker.currentPage === picker.pageCount}
            onClick={() => picker.selectPage(picker.currentPage + 1)}
          >
            Next page
          </Button>
        </div>
      )}
    </fieldset>
  );
}
