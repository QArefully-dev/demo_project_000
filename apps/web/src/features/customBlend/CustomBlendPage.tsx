import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { CartLine } from '@shop/contracts/cart';
import type { CustomBlendOption, CustomBlendOptionsResponse } from '@shop/contracts/custom-blends';
import type { PreviewIngredient } from './CustomBlendPreview';

import { getCustomBlendOptions } from '@/api/customBlends';
import { Button } from '@/components/ui/button';
import { useCartContext } from '@/hooks/CartContext';
import { BasePicker, SelectedBaseChip } from './BasePicker';
import { BlendSummaryAside } from './BlendSummaryAside';
import { IngredientPicker } from './IngredientPicker';
import { RatioEditor } from './RatioEditor';
import { SuccessRecap } from './SuccessRecap';
import {
  MAX_INGREDIENTS,
  MAX_INGREDIENT_PERCENTAGE,
  MIN_INGREDIENT_PERCENTAGE,
  customBlendReducer,
  customBlendValidation,
  derivedBasePercentage,
  initialCustomBlendState,
  ingredientTotalPercentage,
  balanceEvenlyPercentages,
  isIngredientLimitReached,
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
  const [result, setResult] = useState<{
    kind: 'created' | 'replaced';
    base: CustomBlendOption;
    basePercentage: number;
    ingredients: PreviewIngredient[];
    authoritativeConfigKey?: string;
  } | null>(null);
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
      const completedCart =
        state.editConfigKey === null
          ? await addCustomBlend({ baseVariantId: state.baseVariantId, ingredients })
          : await replaceCustomBlend({
              baseVariantId: state.baseVariantId,
              configKey: state.editConfigKey,
              ingredients,
            });
      if (completedCart && options) {
        const authoritativeConfigKey = completedCart.items.find(
          (item) =>
            item.variantSnap?.variantId === state.baseVariantId &&
            item.customBlend?.basePercentage === basePercentage &&
            item.customBlend.ingredients.length === ingredients.length &&
            item.customBlend.ingredients.every((ingredient) =>
              ingredients.some(
                (submitted) =>
                  submitted.variantId === ingredient.variantId &&
                  submitted.percentage === ingredient.percentage,
              ),
            ),
        )?.configKey;
        setResult({
          kind: state.editConfigKey === null ? 'created' : 'replaced',
          base: options.base,
          basePercentage,
          ingredients: options.ingredients
            .filter((option) => percentages.has(option.variant.variantId))
            .map((option) => ({
              option,
              percentage: percentages.get(option.variant.variantId) ?? 0,
            })),
          authoritativeConfigKey,
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const percentages = new Map(
    state.ingredients.map((ingredient) => [ingredient.variantId, ingredient.percentage]),
  );
  if (result !== null) {
    return (
      <SuccessRecap
        result={result.kind}
        base={result.base}
        basePercentage={result.basePercentage}
        ingredients={result.ingredients}
        authoritativeConfigKey={result.authoritativeConfigKey}
      />
    );
  }
  return (
    <div className="content-shell pb-12">
      <header className="mb-7 max-w-3xl">
        <p className="custom-blend-eyebrow-rule section-eyebrow">Custom Blend</p>
        <h1 className="section-heading mt-2">
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
        <div aria-live="polite" aria-label="Loading blend options" className="grid gap-3">
          <div className="h-32 animate-pulse rounded-xl bg-muted" />
          <div className="h-32 animate-pulse rounded-xl bg-muted" />
        </div>
      ) : (
        <form
          onSubmit={(event) => void handleSubmit(event)}
          className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]"
        >
          <div className="grid gap-8">
            <section
              aria-labelledby="custom-blend-base-heading"
              className="custom-blend-surface rounded-xl p-5"
            >
              <p className="text-sm font-medium text-muted-foreground">1. Base</p>
              <h2 id="custom-blend-base-heading" className="text-xl font-semibold">
                Base material
              </h2>
              {!isEditing && <SelectedBaseChip base={options.base} onChange={clearBase} />}
              {state.lockedQuantity !== null && (
                <p className="mt-1 text-sm text-muted-foreground">
                  Quantity: {state.lockedQuantity} sack{state.lockedQuantity === 1 ? '' : 's'}. Base
                  material and quantity stay fixed while editing a blend.
                </p>
              )}
            </section>
            <IngredientPicker
              options={options.ingredients}
              selectedVariantIds={state.ingredients.map((ingredient) => ingredient.variantId)}
              isLimitReached={isIngredientLimitReached(state)}
              onToggle={(variantId) => dispatch({ type: 'ingredient-toggled', variantId })}
            />
            <RatioEditor
              options={options.ingredients}
              selectedVariantIds={state.ingredients.map((ingredient) => ingredient.variantId)}
              percentages={percentages}
              onPercentageChange={(variantId, percentage) =>
                dispatch({ type: 'percentage-changed', variantId, percentage })
              }
              onBalanceEvenly={() => {
                const balanced = balanceEvenlyPercentages(
                  state.ingredients.map((ingredient) => ingredient.variantId),
                );
                state.ingredients.forEach((ingredient) =>
                  dispatch({
                    type: 'percentage-changed',
                    variantId: ingredient.variantId,
                    percentage: balanced.get(ingredient.variantId) ?? ingredient.percentage,
                  }),
                );
              }}
            />
          </div>
          <BlendSummaryAside
            base={options.base}
            basePercentage={basePercentage}
            totalPercentage={totalPercentage}
            ingredientCount={state.ingredients.length}
            errors={validation.errors}
            isEditing={isEditing}
            isValid={validation.isValid}
            isCartAvailable={isCartAvailable}
            isSubmitting={isSubmitting}
            mixBase={{
              productId: options.base.productId,
              productName: options.base.productName,
              category: options.base.category,
              percentage: basePercentage,
            }}
            mixIngredients={options.ingredients
              .filter((option) => percentages.has(option.variant.variantId))
              .map((option) => ({
                productId: option.productId,
                productName: option.productName,
                category: option.category,
                percentage: percentages.get(option.variant.variantId) ?? 0,
              }))}
            previewIngredients={options.ingredients
              .filter((option) => percentages.has(option.variant.variantId))
              .map((option) => ({
                option,
                percentage: percentages.get(option.variant.variantId) ?? 0,
              }))}
            configKey={state.editConfigKey ?? undefined}
          />
        </form>
      )}
    </div>
  );
}
