import type { Static } from '@sinclair/typebox';
import type { IncompatibleGroupError } from '@shop/contracts/customPowder';

type CompatibilityGuardProps = {
  error: Static<typeof IncompatibleGroupError> | null;
  productNamesById: ReadonlyMap<string, string>;
};

export function CompatibilityGuard({ error, productNamesById }: CompatibilityGuardProps) {
  if (!error) return null;
  return (
    <section
      role="alert"
      className="rounded-xl border border-destructive/50 bg-destructive/5 p-4"
      aria-labelledby="compatibility-guard-heading"
    >
      <h2 id="compatibility-guard-heading" className="font-semibold text-destructive">
        Mixing group mismatch
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        The selected powders belong to incompatible mixing groups and cannot be combined together.
      </p>
      <ul className="mt-3 space-y-1 text-sm" aria-label="Conflicting products">
        {error.conflictingProductIds.map((productId) => {
          const groupInfo = error.groupInfo.find((g) => g.productId === productId);
          const name = productNamesById.get(productId) ?? `Product ${productId}`;
          const group = groupInfo?.mixingGroup ?? 'unknown';
          return (
            <li key={productId} className="flex items-baseline justify-between gap-3">
              <span>{name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">Group: {group}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-sm text-muted-foreground">
        Remove one or more products and choose powders from a single compatible group.
      </p>
    </section>
  );
}
