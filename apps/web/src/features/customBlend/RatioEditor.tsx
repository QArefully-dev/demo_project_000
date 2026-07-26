import { useEffect, useRef } from 'react';
import type { CustomBlendOption } from '@shop/contracts/custom-blends';
import { MAX_INGREDIENT_PERCENTAGE, MIN_INGREDIENT_PERCENTAGE } from './customBlendState';

export function RatioEditor({
  options,
  selectedVariantIds,
  percentages,
  onPercentageChange,
  onBalanceEvenly,
}: {
  options: readonly CustomBlendOption[];
  selectedVariantIds: readonly number[];
  percentages: ReadonlyMap<number, number>;
  onPercentageChange: (variantId: number, percentage: number) => void;
  onBalanceEvenly: () => void;
}) {
  const selected = options.filter((option) =>
    selectedVariantIds.includes(option.variant.variantId),
  );
  const totalPercentage = selected.reduce(
    (sum, option) => sum + (percentages.get(option.variant.variantId) ?? 0),
    0,
  );
  const remainingBudget = Math.max(0, 50 - totalPercentage);
  const changePercentage = (variantId: number, value: number) => {
    const currentPercentage = percentages.get(variantId) ?? MIN_INGREDIENT_PERCENTAGE;
    const otherIngredientTotal = totalPercentage - currentPercentage;
    const maximumForIngredient = Math.min(MAX_INGREDIENT_PERCENTAGE, 50 - otherIngredientTotal);
    const normalizedValue = Number.isFinite(value) ? Math.round(value) : MIN_INGREDIENT_PERCENTAGE;
    onPercentageChange(
      variantId,
      Math.max(
        MIN_INGREDIENT_PERCENTAGE,
        Math.min(Math.max(MIN_INGREDIENT_PERCENTAGE, maximumForIngredient), normalizedValue),
      ),
    );
  };
  const priorSelectedIds = useRef(selectedVariantIds);
  useEffect(() => {
    const added = selectedVariantIds.find(
      (variantId) => !priorSelectedIds.current.includes(variantId),
    );
    const removedIndex = priorSelectedIds.current.findIndex(
      (variantId) => !selectedVariantIds.includes(variantId),
    );
    priorSelectedIds.current = selectedVariantIds;
    const focusVariantId =
      added ??
      (removedIndex >= 0
        ? selectedVariantIds[Math.min(removedIndex, selectedVariantIds.length - 1)]
        : undefined);
    if (focusVariantId !== undefined) {
      document.getElementById(`custom-blend-percentage-${focusVariantId}`)?.focus();
    }
  }, [selectedVariantIds]);
  if (selected.length === 0) return null;
  return (
    <section aria-labelledby="custom-blend-ratios-heading" className="grid gap-3">
      <h2 id="custom-blend-ratios-heading" className="text-xl font-semibold">
        3. Ratios
      </h2>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground" aria-live="polite" aria-atomic="true">
          Ingredients total {totalPercentage}% of the 50% budget. {remainingBudget}% remaining.
        </p>
        <button
          type="button"
          className="rounded-md border px-3 py-1.5 text-sm"
          onClick={onBalanceEvenly}
        >
          Balance evenly
        </button>
      </div>
      <ul className="grid gap-3">
        {selected.map((option) => {
          const id = `custom-blend-percentage-${option.variant.variantId}`;
          return (
            <li
              key={option.variant.variantId}
              className="custom-blend-surface flex items-center gap-2 rounded-xl px-4 py-3"
            >
              <label htmlFor={id} className="min-w-32 text-sm">
                {option.productName} percentage
              </label>
              <input
                type="range"
                aria-label={`${option.productName} percentage slider`}
                min={MIN_INGREDIENT_PERCENTAGE}
                max={MAX_INGREDIENT_PERCENTAGE}
                step={1}
                value={percentages.get(option.variant.variantId) ?? MIN_INGREDIENT_PERCENTAGE}
                onChange={(event) =>
                  changePercentage(option.variant.variantId, Number(event.target.value))
                }
              />
              <button
                type="button"
                aria-label={`Decrease ${option.productName} percentage`}
                className="rounded border px-2"
                onClick={() =>
                  changePercentage(
                    option.variant.variantId,
                    (percentages.get(option.variant.variantId) ?? MIN_INGREDIENT_PERCENTAGE) - 1,
                  )
                }
              >
                −
              </button>
              <input
                type="number"
                id={id}
                className="w-24 rounded-md border px-2 py-1 text-sm"
                inputMode="numeric"
                min={MIN_INGREDIENT_PERCENTAGE}
                max={MAX_INGREDIENT_PERCENTAGE}
                step={1}
                value={percentages.get(option.variant.variantId) ?? MIN_INGREDIENT_PERCENTAGE}
                onChange={(event) =>
                  changePercentage(option.variant.variantId, Number(event.target.value))
                }
              />
              <button
                type="button"
                aria-label={`Increase ${option.productName} percentage`}
                className="rounded border px-2"
                onClick={() =>
                  changePercentage(
                    option.variant.variantId,
                    (percentages.get(option.variant.variantId) ?? MIN_INGREDIENT_PERCENTAGE) + 1,
                  )
                }
              >
                +
              </button>
              <span className="text-sm text-muted-foreground">%</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
