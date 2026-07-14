import type { Product } from '@shop/contracts/products';
import { Button } from '@/components/ui/button';
import { formatMoney } from '@/lib/formatMoney';

type ComponentPickerProps = {
  products: Product[];
  selectedProductIds: readonly string[];
  onAdd: (productId: string) => void;
};

export function ComponentPicker({ products, selectedProductIds, onAdd }: ComponentPickerProps) {
  const isAtMaximum = selectedProductIds.length >= 5;
  return (
    <fieldset className="rounded-xl border border-border bg-surface-raised p-4">
      <legend className="px-1 font-semibold">1. Choose powders</legend>
      <p className="mb-3 text-sm text-muted-foreground">Choose 2 to 5 eligible powders.</p>
      <p className="mb-3 text-sm" aria-live="polite">
        <strong>{selectedProductIds.length}</strong> of 5 powders selected
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {products.map((product) => {
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
    </fieldset>
  );
}
