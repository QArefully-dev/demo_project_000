import { useEffect, useRef } from 'react';
import type { Product } from '@shop/contracts/products';
import { Button } from '@/components/ui/button';
import type { BuilderComponent } from './powderizerState';

type RatioEditorProps = {
  components: readonly BuilderComponent[];
  products: readonly Product[];
  onPercentageChange: (productId: string, percentage: number) => void;
  onRemove: (productId: string) => void;
  onEqualSplit: () => void;
};

export function RatioEditor({
  components,
  products,
  onPercentageChange,
  onRemove,
  onEqualSplit,
}: RatioEditorProps) {
  const focusAfterRemovalRef = useRef<string | null>(null);
  const total = components.reduce((sum, component) => sum + component.percentage, 0);
  const isValid = total === 100;
  const productById = new Map(products.map((product) => [product.id, product]));
  const removeAndFocus = (productId: string) => {
    const index = components.findIndex((component) => component.productId === productId);
    const nextId = components[index + 1]?.productId ?? components[index - 1]?.productId;
    focusAfterRemovalRef.current = nextId ?? null;
    onRemove(productId);
  };
  useEffect(() => {
    const productId = focusAfterRemovalRef.current;
    if (!productId) return;
    document.getElementById(`ratio-${productId}`)?.focus();
    focusAfterRemovalRef.current = null;
  }, [components]);
  return (
    <fieldset className="rounded-xl border border-border bg-surface-raised p-4">
      <legend className="font-semibold">2. Set ratios</legend>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={components.length < 2}
          onClick={onEqualSplit}
        >
          Split equally
        </Button>
      </div>
      <output
        className={`mb-3 block rounded-md border px-3 py-2 text-sm ${isValid ? 'border-success/50 bg-success/10' : 'border-destructive/50 bg-destructive/5'}`}
        aria-live="polite"
      >
        Ratio total: {total}% — {isValid ? 'valid' : 'must equal 100%'}
      </output>
      {components.length === 0 ? (
        <p className="text-sm text-muted-foreground">Select powders above to set their ratios.</p>
      ) : (
        <div className="space-y-2">
          {components.map(({ productId, percentage }) => {
            const name = productById.get(productId)?.name ?? `Powder ${productId}`;
            return (
              <div
                key={productId}
                className="grid grid-cols-[minmax(0,1fr)_5.5rem_auto] items-end gap-2 rounded-lg border bg-background p-3"
              >
                <label htmlFor={`ratio-${productId}`} className="min-w-0 text-sm font-medium">
                  <span className="block truncate">{name}</span>
                  <span className="text-xs font-normal text-muted-foreground">Percentage</span>
                </label>
                <input
                  id={`ratio-${productId}`}
                  type="number"
                  min={1}
                  max={99}
                  step={1}
                  inputMode="numeric"
                  value={percentage}
                  onChange={(event) => onPercentageChange(productId, Number(event.target.value))}
                  className="h-8 rounded-lg border border-input bg-transparent px-2 text-right text-sm"
                  aria-label={`${name} percentage`}
                  aria-invalid={percentage < 1 || percentage > 99}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => removeAndFocus(productId)}
                >
                  Remove
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </fieldset>
  );
}
