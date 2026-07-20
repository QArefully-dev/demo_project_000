import type { PowderMixQuote } from '@shop/contracts/powderizer';
import { Button } from '@/components/ui/button';
import { formatMoney } from '@/lib/formatMoney';
import type { BuilderConfig } from './powderizerState';

type PowderizerSummaryProps = {
  quote: PowderMixQuote | null;
  namesByProductId: ReadonlyMap<string, string>;
  canSubmit: boolean;
  isSubmitting: boolean;
  editing: boolean;
  onSubmit: () => void;
  ingredientWarnings?: readonly string[];
  config?: BuilderConfig;
};

export function PowderizerSummary({
  quote,
  namesByProductId,
  canSubmit,
  isSubmitting,
  editing,
  onSubmit,
  ingredientWarnings = [],
  config: _config,
}: PowderizerSummaryProps) {
  return (
    <section
      className="rounded-xl border border-border bg-surface-raised p-4"
      aria-labelledby="mix-summary-title"
    >
      <h2 id="mix-summary-title" className="font-semibold">
        Blend summary
      </h2>
      {!quote ? (
        <p className="mt-2 text-sm text-muted-foreground">
          A current quote appears here after your blend is valid.
        </p>
      ) : (
        <div className="mt-3 space-y-3 text-sm">
          <p
            className="rounded-md border border-primary/35 bg-primary/10 px-3 py-2 font-semibold"
            aria-label="Server usage label"
          >
            {quote.usageLabel}
          </p>
          <ul className="space-y-1" aria-label="Mix components">
            {quote.allocations.map((component) => (
              <li key={component.productId} className="flex justify-between gap-3">
                <span>
                  {namesByProductId.get(component.productId) ?? `Powder ${component.productId}`}
                </span>
                <span className="shrink-0 text-muted-foreground">
                  {component.percentage}% · {component.allocatedGrams}g
                </span>
              </li>
            ))}
          </ul>
          <div className="space-y-1 border-t pt-3">
            <div className="flex justify-between">
              <span>Packaging</span>
              <span>{formatMoney(quote.packagingFeeCents)}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>Unit total</span>
              <span>{formatMoney(quote.unitPriceCents)}</span>
            </div>
          </div>
        </div>
      )}
      {ingredientWarnings.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm text-destructive" aria-label="Ingredient warnings">
          {ingredientWarnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}
      <Button
        type="button"
        className="mt-4 w-full"
        disabled={!canSubmit || isSubmitting}
        onClick={onSubmit}
      >
        {isSubmitting ? 'Saving blend…' : editing ? 'Update cart' : 'Add to cart'}
      </Button>
      {!canSubmit && (
        <p className="mt-2 text-xs text-muted-foreground">
          A valid, current quote is required before adding this blend.
        </p>
      )}
    </section>
  );
}
