import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Product } from '@shop/contracts/products';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ErrorMessage';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { BagColourSchemePicker } from './BagColourSchemePicker';
import { ComponentPicker, useComponentPicker } from './ComponentPicker';
import { DailyRecipeCard } from './DailyRecipeCard';
import { IngredientReaction } from './IngredientReaction';
import { MixOptions } from './MixOptions';
import { PowderizerActions } from './PowderizerActions';
import { PowderMixBagPreview } from './PowderMixBagPreview';
import { PowderMixVisualization } from './PowderMixVisualization';
import { PowderizerSummary } from './PowderizerSummary';
import { PowderizerHistoryShelf } from './PowderizerHistoryShelf';
import { RatioEditor } from './RatioEditor';
import { usePowderizerHistory } from './usePowderizerHistory';
import { usePowderizerController } from './usePowderizerController';
import type { BuilderConfig } from './powderizerState';

const EMPTY_PRODUCTS: readonly Product[] = [];

export function PowderizerPage() {
  const navigate = useNavigate();
  const historyRecordRef = useRef<(config: BuilderConfig) => void>(() => undefined);
  const recordSuccessfulSubmit = useCallback(
    (config: BuilderConfig) => historyRecordRef.current(config),
    [],
  );
  const {
    state,
    dispatch,
    powderizerConfig,
    remoteError,
    configLoadError,
    validationError,
    hasCurrentQuote,
    canSubmit,
    replaceConfig,
    submit,
  } = usePowderizerController({ onSubmitSuccess: recordSuccessfulSubmit });
  const history = usePowderizerHistory(powderizerConfig?.eligibleProducts ?? EMPTY_PRODUCTS);
  historyRecordRef.current = history.record;
  const builderRef = useRef<HTMLElement>(null);
  const focusAddedComponentRef = useRef<string | null>(null);
  const picker = useComponentPicker(
    powderizerConfig?.eligibleProducts ?? [],
    state.config.components.map(({ productId }) => productId),
  );
  const ingredientWarnings = useMemo(
    () =>
      Array.from(
        new Set(
          state.config.components.flatMap(({ productId }) => {
            const warning = powderizerConfig?.eligibleProducts.find(({ id }) => id === productId)
              ?.packaging?.consumptionLabel;
            return warning ? [warning] : [];
          }),
        ),
      ),
    [powderizerConfig?.eligibleProducts, state.config.components],
  );

  useEffect(() => {
    const productId = focusAddedComponentRef.current;
    if (!productId) return;
    document.getElementById(`ratio-${productId}`)?.focus();
    focusAddedComponentRef.current = null;
  }, [state.config.components]);

  if (!powderizerConfig)
    return remoteError ? (
      <ErrorMessage message={remoteError} onRetry={() => window.location.reload()} />
    ) : (
      <LoadingSpinner />
    );

  const namesByProductId = new Map(
    powderizerConfig.eligibleProducts.map((product) => [product.id, product.name]),
  );
  const selectedProductIds = state.config.components.map(({ productId }) => productId);

  if (state.editError)
    return (
      <div className="mx-auto max-w-2xl space-y-4 py-12 text-center">
        <p role="alert" className="text-destructive">
          {state.editError}
        </p>
        <Button variant="outline" render={<Link to="/cart" />}>
          Return to cart
        </Button>
      </div>
    );

  return (
    <section ref={builderRef} tabIndex={-1} className="mx-auto max-w-6xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Powderizer</h1>
        <p className="mt-2 text-muted-foreground">
          Build a custom powder mix from every eligible category. Server safety labels always apply.
        </p>
      </div>
      <div className="rounded-lg border border-border p-4">
        <p className="font-medium">{state.editMixId ? 'Editing custom mix' : 'New custom mix'}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {powderizerConfig.eligibleProducts.length} eligible powders available.
        </p>
        {(validationError || configLoadError) && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {validationError ?? configLoadError}
          </p>
        )}
        {state.quote.status === 'loading' && (
          <p aria-live="polite" className="mt-3 text-sm text-muted-foreground">
            Calculating quote…
          </p>
        )}
        {state.quote.status === 'error' && (
          <div role="alert" className="mt-3 flex items-center gap-3 text-sm text-destructive">
            <p>{state.quote.error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => dispatch({ type: 'quote-retry-requested' })}
            >
              Retry quote
            </Button>
          </div>
        )}
        {state.mutation.status === 'error' && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {state.mutation.error}
          </p>
        )}
      </div>
      <PowderizerActions
        activeProducts={picker.activeProducts}
        products={powderizerConfig.eligibleProducts}
        baseConfig={state.config}
        bagSizes={powderizerConfig.bagSizesGrams}
        finenessValues={powderizerConfig.finenessValues}
        bagColourSchemes={powderizerConfig.bagColourSchemes}
        onConfigGenerated={replaceConfig}
      />
      <DailyRecipeCard recipe={powderizerConfig.dailyRecipe} onLoad={replaceConfig} />
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-5">
          <ComponentPicker
            picker={picker}
            selectedProductIds={selectedProductIds}
            onAdd={(productId) => {
              focusAddedComponentRef.current = productId;
              dispatch({ type: 'component-added', productId });
            }}
          />
          <RatioEditor
            components={state.config.components}
            products={powderizerConfig.eligibleProducts}
            onPercentageChange={(productId, percentage) =>
              dispatch({ type: 'percentage-changed', productId, percentage })
            }
            onRemove={(productId) => dispatch({ type: 'component-removed', productId })}
            onEqualSplit={() => dispatch({ type: 'equal-split' })}
          />
          <MixOptions
            config={state.config}
            bagSizes={powderizerConfig.bagSizesGrams}
            finenessValues={powderizerConfig.finenessValues}
            labelMaxGraphemes={powderizerConfig.labelMaxGraphemes}
            onBagSizeChange={(bagSizeGrams) => dispatch({ type: 'bag-size-changed', bagSizeGrams })}
            onFinenessChange={(fineness) => dispatch({ type: 'fineness-changed', fineness })}
            onLabelChange={(customLabel) => dispatch({ type: 'label-changed', customLabel })}
          />
          <BagColourSchemePicker
            schemes={powderizerConfig.bagColourSchemes}
            value={state.config.bagColourScheme}
            onChange={(bagColourScheme) =>
              dispatch({ type: 'bag-colour-changed', bagColourScheme })
            }
          />
          <PowderMixVisualization
            components={state.config.components}
            products={powderizerConfig.eligibleProducts}
          />
          <IngredientReaction
            components={state.config.components}
            products={powderizerConfig.eligibleProducts}
          />
        </div>
        <aside className="space-y-5 lg:sticky lg:top-24">
          <PowderMixBagPreview
            config={state.config}
            priceVersion={powderizerConfig.priceVersion}
            usageLabel={state.quote.status === 'ready' ? state.quote.quote.usageLabel : null}
          />
          <PowderizerSummary
            quote={hasCurrentQuote ? state.quote.quote : null}
            namesByProductId={namesByProductId}
            ingredientWarnings={ingredientWarnings}
            config={state.config}
            canSubmit={canSubmit}
            isSubmitting={state.mutation.status === 'submitting'}
            editing={state.editMixId !== null}
            onSubmit={() => void submit()}
          />
        </aside>
      </div>
      <PowderizerHistoryShelf
        entries={history.entries}
        available={history.available}
        onUseAgain={(entry) => {
          dispatch({ type: 'history-config-loaded', config: entry.config });
          navigate('/powderizer', { replace: true });
          window.requestAnimationFrame(() => builderRef.current?.focus());
        }}
        onRemove={history.remove}
        onClear={history.clear}
      />
    </section>
  );
}
