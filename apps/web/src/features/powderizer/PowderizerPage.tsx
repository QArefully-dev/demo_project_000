import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ErrorMessage';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useCartContext } from '@/hooks/CartContext';
import { ApiError } from '@/api/client';
import {
  createPowderMix,
  getPowderizerConfig,
  quotePowderMix,
  updatePowderMix,
} from '@/api/powderizer';
import type { PowderizerConfigResponse } from '@shop/contracts/powderizer';
import { ComponentPicker } from './ComponentPicker';
import { MixOptions } from './MixOptions';
import { PowderMixBagPreview } from './PowderMixBagPreview';
import { PowderizerSummary } from './PowderizerSummary';
import { RatioEditor } from './RatioEditor';
import {
  builderQuoteKey,
  initialPowderizerState,
  powderizerReducer,
  toPowderMixConfigInput,
  validateBuilderConfig,
} from './powderizerState';

function messageFor(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.isNetworkError)
    return 'Unable to reach the shop server. Check that it is running and try again.';
  return error instanceof Error ? error.message : fallback;
}

export function PowderizerPage() {
  const { cart, cartId, isInitializing, refreshCart } = useCartContext();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [state, dispatch] = useReducer(powderizerReducer, undefined, initialPowderizerState);
  const [remote, setRemote] = useState<{
    data: PowderizerConfigResponse | null;
    error: string | null;
  }>({ data: null, error: null });
  const hydratedEditRef = useRef<string | null>(null);
  const focusAddedComponentRef = useRef<string | null>(null);
  const quoteRequestRef = useRef(0);
  const editMixId = searchParams.get('edit');
  const validationError = useMemo(() => validateBuilderConfig(state.config), [state.config]);
  const quoteKey = useMemo(() => builderQuoteKey(state.config), [state.config]);

  useEffect(() => {
    const productId = focusAddedComponentRef.current;
    if (!productId) return;
    document.getElementById(`ratio-${productId}`)?.focus();
    focusAddedComponentRef.current = null;
  }, [state.config.components]);

  useEffect(() => {
    const controller = new AbortController();
    void getPowderizerConfig(controller.signal)
      .then((data) => setRemote({ data, error: null }))
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setRemote({
            data: null,
            error: messageFor(error, 'Failed to load Powderizer configuration.'),
          });
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!editMixId) {
      hydratedEditRef.current = null;
      if (state.editMixId !== null || state.editError !== null) dispatch({ type: 'edit-cleared' });
      return;
    }
    if (isInitializing || hydratedEditRef.current === editMixId) return;
    hydratedEditRef.current = editMixId;
    const item = cart?.mixItems.find(({ mixId }) => mixId === editMixId);
    dispatch(item ? { type: 'edit-hydrated', item } : { type: 'edit-missing', mixId: editMixId });
  }, [cart?.mixItems, editMixId, isInitializing, state.editError, state.editMixId]);

  useEffect(() => {
    if (!remote.data || validationError) return;
    const controller = new AbortController();
    const requestId = ++quoteRequestRef.current;
    const timer = window.setTimeout(() => {
      dispatch({ type: 'quote-started', key: quoteKey, requestId });
      void quotePowderMix(toPowderMixConfigInput(state.config), controller.signal)
        .then((quote) => dispatch({ type: 'quote-succeeded', key: quoteKey, requestId, quote }))
        .catch((error: unknown) => {
          if (!controller.signal.aborted)
            dispatch({
              type: 'quote-failed',
              key: quoteKey,
              requestId,
              error: messageFor(error, 'Unable to calculate this mix.'),
            });
        });
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [quoteKey, remote.data, state.config, state.quoteRetry, validationError]);

  if (!remote.data)
    return remote.error ? (
      <ErrorMessage message={remote.error} onRetry={() => window.location.reload()} />
    ) : (
      <LoadingSpinner />
    );
  const powderizerConfig = remote.data;
  const namesByProductId = new Map(
    powderizerConfig.eligibleProducts.map((product) => [product.id, product.name]),
  );
  const hasCurrentQuote = state.quote.status === 'ready' && state.quote.key === quoteKey;
  const canSubmit = !validationError && hasCurrentQuote && state.mutation.status !== 'submitting';

  const submit = async () => {
    if (!canSubmit || !cartId) {
      if (!cartId)
        dispatch({
          type: 'mutation-failed',
          error: 'Your cart is still loading. Try again in a moment.',
        });
      return;
    }
    dispatch({ type: 'mutation-started' });
    try {
      const body = toPowderMixConfigInput(state.config);
      if (state.editMixId) await updatePowderMix(cartId, state.editMixId, body);
      else await createPowderMix(cartId, body);
      await refreshCart();
      dispatch({ type: 'mutation-finished' });
      navigate('/cart');
    } catch (error) {
      dispatch({ type: 'mutation-failed', error: messageFor(error, 'Unable to save this mix.') });
    }
  };

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
    <section className="mx-auto max-w-6xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Powderizer</h1>
        <p className="mt-2 text-muted-foreground">
          Build a custom consumable powder mix from Pantry, Performance, and Drinks powders.
        </p>
      </div>
      <p className="rounded-lg border border-border bg-surface-raised p-4 text-sm text-muted-foreground">
        Only consumable Pantry, Performance, and Drinks powders are mixable in V1. Choose 2 to 5
        powders, then set ratios totalling 100%.
      </p>
      <div className="rounded-lg border border-border p-4">
        <p className="font-medium">{state.editMixId ? 'Editing custom mix' : 'New custom mix'}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {powderizerConfig.eligibleProducts.length} eligible powders available.
        </p>
        {validationError && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {validationError}
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
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-5">
          <ComponentPicker
            products={powderizerConfig.eligibleProducts}
            selectedProductIds={state.config.components.map(({ productId }) => productId)}
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
        </div>
        <aside className="space-y-5 lg:sticky lg:top-24">
          <PowderMixBagPreview config={state.config} priceVersion={powderizerConfig.priceVersion} />
          <PowderizerSummary
            quote={hasCurrentQuote ? state.quote.quote : null}
            namesByProductId={namesByProductId}
            canSubmit={canSubmit}
            isSubmitting={state.mutation.status === 'submitting'}
            editing={state.editMixId !== null}
            onSubmit={() => void submit()}
          />
        </aside>
      </div>
    </section>
  );
}
