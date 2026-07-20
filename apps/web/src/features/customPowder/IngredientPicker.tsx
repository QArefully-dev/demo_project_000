import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { formatMoney } from '@/lib/formatMoney';
import { useComponentPicker } from './useComponentPicker';

type IngredientPickerProps = {
  selectedProductIds: readonly string[];
  onAdd: (productId: string) => void;
  picker: ReturnType<typeof useComponentPicker>;
};

export function IngredientPicker({ selectedProductIds, onAdd, picker }: IngredientPickerProps) {
  const isAtMaximum = selectedProductIds.length >= 5;
  const selectedGroups = useMemo(
    () => {
      const groups = new Set<string>();
      let hasClassification = false;
      for (const product of picker.activeProducts) {
        if (selectedProductIds.includes(product.id) && product.consumptionClassification) {
          groups.add(product.consumptionClassification);
          hasClassification = true;
        }
      }
      return hasClassification ? groups : null;
    },
    [picker.activeProducts, selectedProductIds],
  );
  const resultCount = picker.activeProducts.length;

  return (
    <fieldset className="rounded-xl border border-border bg-surface-raised p-4">
      <legend className="px-1 font-semibold">1. Choose powders</legend>
      <p className="mb-3 text-sm text-muted-foreground">
        Products are organised by category. Server mixes only powders from compatible groups.
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
            const isIncompatible =
              selectedGroups !== null &&
              !selected &&
              product.consumptionClassification &&
              !selectedGroups.has(product.consumptionClassification);
            return (
              <div
                key={product.id}
                className="flex min-w-0 items-center justify-between gap-3 rounded-lg border bg-background p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{product.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {product.category}
                    {isIncompatible ? ' — different mix group' : ''} ·{' '}
                    {formatMoney(product.priceCents)} source bag
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={selected ? 'secondary' : 'outline'}
                  disabled={selected || isAtMaximum || isIncompatible}
                  onClick={() => onAdd(product.id)}
                  aria-describedby={isIncompatible ? `incompat-${product.id}` : undefined}
                >
                  {selected ? 'Selected' : isIncompatible ? 'Incompatible' : 'Add'}
                </Button>
                {isIncompatible && (
                  <span id={`incompat-${product.id}`} hidden>
                    This product belongs to a different mixing group than your selected powders.
                  </span>
                )}
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
