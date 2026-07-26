import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { SACK_WEIGHT_GRAMS } from '@shop/contracts/pricing';
import type { CartLine } from '@shop/contracts/cart';
import type { CustomBlendOption, CustomBlendOptionsResponse } from '@shop/contracts/custom-blends';
import { getCustomBlendOptions } from '@/api/customBlends';
import { getProduct } from '@/api/products';
import { useCartContext } from '@/hooks/CartContext';
import { useCategories } from '@/hooks/useCategories';
import { useProducts } from '@/hooks/useProducts';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ErrorMessage';
import { CUSTOM_BLEND_MADE_TO_ORDER_NOTE } from './CustomBlendPackaging';
import {
  MAX_INGREDIENTS,
  MAX_INGREDIENT_PERCENTAGE,
  MIN_INGREDIENT_PERCENTAGE,
  customBlendReducer,
  customBlendValidation,
  derivedBasePercentage,
  initialCustomBlendState,
  ingredientTotalPercentage,
  isIngredientLimitReached,
  isIngredientSelected,
  snapshotToDraftIngredients,
  toIngredientInputs,
} from './customBlendState';

const INVALID_BASE_MESSAGE =
  'That base material is not available for Custom Blend. Choose another base below.';
const MISSING_LINE_MESSAGE =
  'That custom blend is no longer in your cart. Start a new blend to continue.';

function parsePositiveInteger(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

/** The purchase unit for a blend is the 25 kg sack, so only that variant can be a base. */
function findSackVariant(variants: { weightGrams: number; active: boolean; variantId: number }[]) {
  return variants.find((variant) => variant.active && variant.weightGrams === SACK_WEIGHT_GRAMS);
}

const NO_SACK_VARIANT_MESSAGE =
  'That material is not stocked in a 25 kg sack, so it cannot be a blend base. Choose another material.';

export function CustomBlendPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const baseVariantParam = searchParams.get('baseVariantId');
  const editConfigKey = searchParams.get('editConfigKey');
  const baseVariantId = parsePositiveInteger(baseVariantParam);
  const hasUnparseableBaseParam = baseVariantParam !== null && baseVariantId === null;

  const {
    cart,
    error: cartError,
    isCartAvailable,
    addCustomBlend,
    replaceCustomBlend,
    retryCart,
  } = useCartContext();

  const [state, dispatch] = useReducer(customBlendReducer, initialCustomBlendState);
  const [options, setOptions] = useState<CustomBlendOptionsResponse | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [isOptionsLoading, setIsOptionsLoading] = useState(false);
  const [lineError, setLineError] = useState<string | null>(null);
  const [result, setResult] = useState<'created' | 'replaced' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const optionsRequestIdRef = useRef(0);
  const hydratedTargetRef = useRef<string | null>(null);
  const activeTargetRef = useRef<string | null>(null);

  // The URL owns the configurator target. Every change to it is pushed into the draft so no
  // part of the draft — base lot, edit config key, locked quantity — can outlive the URL that
  // produced it. Leaving edit mode is therefore a URL edit, not a separate reducer path.
  const targetKey = `${baseVariantId ?? ''}:${editConfigKey ?? ''}`;
  useEffect(() => {
    if (activeTargetRef.current === targetKey) return;
    activeTargetRef.current = targetKey;
    // A new target must be re-hydrated from the cart, including a return to a target that was
    // hydrated earlier in this mount.
    hydratedTargetRef.current = null;
    setLineError(null);
    dispatch({ type: 'target-changed', baseVariantId, editConfigKey });
  }, [baseVariantId, editConfigKey, targetKey]);

  // Each base change starts a new options query. A superseded response is dropped rather
  // than allowed to repopulate the picker behind the customer's current choice.
  useEffect(() => {
    if (baseVariantId === null) {
      setOptions(null);
      setOptionsError(null);
      setIsOptionsLoading(false);
      return;
    }
    const requestId = ++optionsRequestIdRef.current;
    const controller = new AbortController();
    const isCurrent = () => requestId === optionsRequestIdRef.current;
    setOptions(null);
    setOptionsError(null);
    setIsOptionsLoading(true);

    void (async () => {
      try {
        const data = await getCustomBlendOptions(baseVariantId, controller.signal);
        if (!isCurrent()) return;
        setOptions(data);
      } catch (error) {
        if (!isCurrent()) return;
        setOptionsError(error instanceof Error ? error.message : INVALID_BASE_MESSAGE);
      } finally {
        if (isCurrent()) setIsOptionsLoading(false);
      }
    })();

    return () => {
      ++optionsRequestIdRef.current;
      controller.abort();
    };
  }, [baseVariantId]);

  const editLine: CartLine | null = useMemo(() => {
    if (!editConfigKey || baseVariantId === null || !cart) return null;
    return (
      cart.items.find(
        (item) => item.configKey === editConfigKey && item.variantSnap?.variantId === baseVariantId,
      ) ?? null
    );
  }, [baseVariantId, cart, editConfigKey]);

  // Hydrate the draft once per edit target: a later cart refresh must not discard
  // in-progress edits, and a completed replace must not re-read its own stale key.
  useEffect(() => {
    if (!editConfigKey || baseVariantId === null || result !== null) return;
    const target = `${baseVariantId}:${editConfigKey}`;
    if (hydratedTargetRef.current === target) return;
    if (!cart) return;
    if (!editLine?.customBlend) {
      setLineError(MISSING_LINE_MESSAGE);
      return;
    }
    hydratedTargetRef.current = target;
    setLineError(null);
    dispatch({
      type: 'edit-loaded',
      baseVariantId,
      configKey: editConfigKey,
      quantity: editLine.quantity,
      ingredients: snapshotToDraftIngredients(editLine.customBlend),
    });
  }, [baseVariantId, cart, editConfigKey, editLine, result]);

  const validation = customBlendValidation(state);
  const basePercentage = derivedBasePercentage(state);
  const totalPercentage = ingredientTotalPercentage(state);
  const isEditing = state.editConfigKey !== null;

  const selectBase = (variantId: number) => {
    const next = new URLSearchParams(searchParams);
    next.set('baseVariantId', String(variantId));
    next.delete('editConfigKey');
    setSearchParams(next);
  };

  const clearBase = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('baseVariantId');
    next.delete('editConfigKey');
    setSearchParams(next);
  };

  // Defence in depth: a draft that does not match the target currently named by the URL must
  // never reach the cart, because a replace keyed on a stale config key would overwrite a
  // different line than the one on screen.
  const isDraftOnCurrentTarget =
    state.baseVariantId === baseVariantId &&
    (state.editConfigKey === null || state.editConfigKey === editConfigKey);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validation.isValid || state.baseVariantId === null || isSubmitting) return;
    if (!isDraftOnCurrentTarget) return;
    setIsSubmitting(true);
    try {
      const ingredients = toIngredientInputs(state);
      const succeeded =
        state.editConfigKey === null
          ? await addCustomBlend({ baseVariantId: state.baseVariantId, ingredients })
          : await replaceCustomBlend({
              baseVariantId: state.baseVariantId,
              configKey: state.editConfigKey,
              ingredients,
            });
      if (succeeded) setResult(state.editConfigKey === null ? 'created' : 'replaced');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (result !== null) {
    return (
      <div className="pb-12">
        <h1 className="text-3xl font-semibold tracking-tight">
          {result === 'created' ? 'Custom blend added to your cart' : 'Custom blend updated'}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{CUSTOM_BLEND_MADE_TO_ORDER_NOTE}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button nativeButton={false} render={<Link to="/cart" />}>
            View cart
          </Button>
          <Button variant="outline" nativeButton={false} render={<Link to="/catalog" />}>
            Keep shopping
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-12">
      <header className="mb-7 max-w-3xl">
        <p className="section-eyebrow">Custom Blend</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          {isEditing ? 'Edit your custom blend' : 'Build a custom blend'}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Pick one base material, then add 1 to {MAX_INGREDIENTS} ingredients at{' '}
          {MIN_INGREDIENT_PERCENTAGE}% to {MAX_INGREDIENT_PERCENTAGE}% each.
        </p>
      </header>

      {(hasUnparseableBaseParam || optionsError) && (
        <div role="alert" className="mb-6 rounded-xl border border-destructive/40 px-4 py-3">
          <p className="text-sm text-destructive">
            {hasUnparseableBaseParam ? INVALID_BASE_MESSAGE : optionsError}
          </p>
          <Button className="mt-3" variant="outline" size="sm" onClick={clearBase}>
            Choose another base
          </Button>
        </div>
      )}

      {lineError && (
        <div role="alert" className="mb-6 rounded-xl border border-destructive/40 px-4 py-3">
          <p className="text-sm text-destructive">{lineError}</p>
          <Button className="mt-3" variant="outline" size="sm" onClick={clearBase}>
            Start a new blend
          </Button>
        </div>
      )}

      {cartError && (
        <div
          role="alert"
          className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-destructive/40 px-4 py-3"
        >
          <p className="text-sm text-destructive">{cartError}</p>
          <Button variant="outline" size="sm" onClick={() => void retryCart()}>
            Retry cart
          </Button>
        </div>
      )}

      {baseVariantId === null || optionsError ? (
        <BasePicker onSelectBase={selectBase} />
      ) : isOptionsLoading || !options ? (
        <p aria-live="polite">Loading blend options…</p>
      ) : (
        <form onSubmit={(event) => void handleSubmit(event)} className="grid gap-8">
          <section aria-labelledby="custom-blend-base-heading">
            <h2 id="custom-blend-base-heading" className="text-xl font-semibold">
              Base material
            </h2>
            <p className="mt-2 text-sm">
              {options.base.productName} — {options.base.variant.label}
            </p>
            {state.lockedQuantity !== null && (
              <p className="mt-1 text-sm text-muted-foreground">
                Quantity: {state.lockedQuantity} sack{state.lockedQuantity === 1 ? '' : 's'}. Base
                material and quantity stay fixed while editing a blend.
              </p>
            )}
            {!isEditing && (
              <Button className="mt-3" variant="outline" size="sm" onClick={clearBase}>
                Change base material
              </Button>
            )}
          </section>

          <fieldset className="grid gap-3 border-none p-0">
            <legend className="text-xl font-semibold">Ingredients</legend>
            {options.ingredients.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No compatible ingredients are available for this base material.
              </p>
            ) : (
              <ul className="grid gap-3">
                {options.ingredients.map((option) => (
                  <IngredientRow
                    key={option.variant.variantId}
                    option={option}
                    isSelected={isIngredientSelected(state, option.variant.variantId)}
                    isDisabled={
                      !isIngredientSelected(state, option.variant.variantId) &&
                      isIngredientLimitReached(state)
                    }
                    percentage={
                      state.ingredients.find(
                        (ingredient) => ingredient.variantId === option.variant.variantId,
                      )?.percentage ?? MIN_INGREDIENT_PERCENTAGE
                    }
                    onToggle={() =>
                      dispatch({
                        type: 'ingredient-toggled',
                        variantId: option.variant.variantId,
                      })
                    }
                    onPercentageChange={(percentage) =>
                      dispatch({
                        type: 'percentage-changed',
                        variantId: option.variant.variantId,
                        percentage,
                      })
                    }
                  />
                ))}
              </ul>
            )}
          </fieldset>

          <section aria-labelledby="custom-blend-summary-heading">
            <h2 id="custom-blend-summary-heading" className="text-xl font-semibold">
              Blend summary
            </h2>
            <p className="mt-2 text-sm" role="status" aria-live="polite">
              Base {basePercentage}% · ingredients {totalPercentage}% · {state.ingredients.length}{' '}
              of {MAX_INGREDIENTS} ingredients selected
            </p>
            {validation.errors.length > 0 && (
              <ul className="mt-3 grid gap-1" role="alert">
                {validation.errors.map((error) => (
                  <li key={error} className="text-sm text-destructive">
                    {error}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div>
            <Button
              type="submit"
              disabled={!validation.isValid || !isCartAvailable || isSubmitting}
            >
              {isEditing ? 'Update blend' : 'Add blend to cart'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

function IngredientRow({
  option,
  isSelected,
  isDisabled,
  percentage,
  onToggle,
  onPercentageChange,
}: {
  option: CustomBlendOption;
  isSelected: boolean;
  isDisabled: boolean;
  percentage: number;
  onToggle: () => void;
  onPercentageChange: (percentage: number) => void;
}) {
  const checkboxId = `custom-blend-ingredient-${option.variant.variantId}`;
  const percentageId = `custom-blend-percentage-${option.variant.variantId}`;
  // Availability is informational only: a blend is made to order, so a sold-out lot
  // remains a legitimate choice.
  const isSoldOut = option.variant.stockCount === 0;

  return (
    <li className="rounded-xl border px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="checkbox"
          id={checkboxId}
          checked={isSelected}
          disabled={isDisabled}
          onChange={onToggle}
        />
        <label htmlFor={checkboxId} className="text-sm font-medium">
          {option.productName}
        </label>
        {isSoldOut && (
          <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
            Out of stock
          </span>
        )}
      </div>
      {isSelected && (
        <div className="mt-3 flex items-center gap-2">
          <label htmlFor={percentageId} className="text-sm">
            {option.productName} percentage
          </label>
          <input
            type="number"
            id={percentageId}
            className="w-24 rounded-md border px-2 py-1 text-sm"
            inputMode="numeric"
            min={MIN_INGREDIENT_PERCENTAGE}
            max={MAX_INGREDIENT_PERCENTAGE}
            step={1}
            value={percentage}
            onChange={(event) => onPercentageChange(Number(event.target.value))}
          />
          <span className="text-sm text-muted-foreground">%</span>
        </div>
      )}
    </li>
  );
}

function BasePicker({ onSelectBase }: { onSelectBase: (variantId: number) => void }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [resolvingProductId, setResolvingProductId] = useState<string | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const resolveRequestIdRef = useRef(0);
  const { categories } = useCategories();
  const { products, isLoading, error, refetch } = useProducts({
    ...(query ? { q: query } : {}),
    ...(category ? { category } : {}),
  });

  // The catalog list response carries no variants, so the eligible sack is resolved from the
  // product detail read at selection time rather than filtered for up front. Filtering the list
  // on a field the list never returns would silently offer no bases at all.
  const selectBaseProduct = async (productId: string) => {
    const requestId = ++resolveRequestIdRef.current;
    const isCurrent = () => requestId === resolveRequestIdRef.current;
    setResolvingProductId(productId);
    setResolveError(null);
    try {
      const detail = await getProduct(productId);
      if (!isCurrent()) return;
      const sackVariant = findSackVariant(detail.variants);
      if (!sackVariant) {
        setResolveError(NO_SACK_VARIANT_MESSAGE);
        return;
      }
      onSelectBase(sackVariant.variantId);
    } catch (caught) {
      if (!isCurrent()) return;
      setResolveError(caught instanceof Error ? caught.message : NO_SACK_VARIANT_MESSAGE);
    } finally {
      if (isCurrent()) setResolvingProductId(null);
    }
  };

  return (
    <section aria-labelledby="custom-blend-base-picker-heading" className="grid gap-4">
      <h2 id="custom-blend-base-picker-heading" className="text-xl font-semibold">
        Choose a base material
      </h2>
      <div className="flex flex-wrap gap-3">
        <div className="grid gap-1">
          <label htmlFor="custom-blend-search" className="text-sm">
            Search materials
          </label>
          <input
            type="search"
            id="custom-blend-search"
            className="rounded-md border px-3 py-1.5 text-sm"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="grid gap-1">
          <label htmlFor="custom-blend-category" className="text-sm">
            Category
          </label>
          <select
            id="custom-blend-category"
            className="rounded-md border px-3 py-1.5 text-sm"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {resolveError && (
        <p role="alert" className="text-sm text-destructive">
          {resolveError}
        </p>
      )}

      {error ? (
        <ErrorMessage message={error} onRetry={() => void refetch()} />
      ) : isLoading ? (
        <p aria-live="polite">Loading materials…</p>
      ) : products.length === 0 ? (
        <p aria-live="polite">No materials match that search.</p>
      ) : (
        <ul className="grid gap-3" aria-label="Base material options">
          {products.map((product) => (
            <li
              key={product.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3"
            >
              <span className="text-sm font-medium">{product.name}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={resolvingProductId !== null}
                onClick={() => void selectBaseProduct(product.id)}
              >
                Use {product.name} as base
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
