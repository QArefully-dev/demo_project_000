import type { PowderMixQuote } from '@shop/contracts/powderizer';
import { Button } from '@/components/ui/button';
import { formatMoney } from '@/lib/formatMoney';

type PowderizerSummaryProps = {
  quote: PowderMixQuote | null;
  namesByProductId: ReadonlyMap<string, string>;
  canSubmit: boolean;
  isSubmitting: boolean;
  editing: boolean;
  onSubmit: () => void;
};

export function PowderizerSummary({
  quote,
  namesByProductId,
  canSubmit,
  isSubmitting,
  editing,
  onSubmit,
}: PowderizerSummaryProps) {
  return (
    <section
      className="rounded-xl border border-border bg-surface-raised p-4"
      aria-labelledby="mix-summary-title"
    >
      <h2 id="mix-summary-title" className="font-semibold">
        Quote summary
      </h2>
      {!quote ? (
        <p className="mt-2 text-sm text-muted-foreground">
          A current quote appears here after your mix is valid.
        </p>
      ) : (
        <div className="mt-3 space-y-3 text-sm">
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
      <Button
        type="button"
        className="mt-4 w-full"
        disabled={!canSubmit || isSubmitting}
        onClick={onSubmit}
      >
        {isSubmitting ? 'Saving mix…' : editing ? 'Update cart' : 'Add to cart'}
      </Button>
      {!canSubmit && (
        <p className="mt-2 text-xs text-muted-foreground">
          A valid, current quote is required before adding this mix.
        </p>
      )}
    </section>
  );
}
