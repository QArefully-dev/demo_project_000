import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { PowderizerConfigResponse } from '@shop/contracts/powderizer';
import { ApiError } from '@/api/client';
import {
  getCustomPowderConfig,
  quoteCustomPowderMix,
  createCustomPowderMix,
  updateCustomPowderMix,
} from '@/api/customPowder';
import { useCartContext } from '@/hooks/CartContext';
import {
  builderQuoteKey,
  initialPowderizerState,
  normalizeBuilderConfig,
  powderizerReducer,
  toPowderMixConfigInput,
  validateBuilderConfig,
  type BuilderConfig,
  type BuilderConfigSource,
} from './powderizerState';

function messageFor(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.isNetworkError)
    return 'Unable to reach the shop server. Check that it is running and try again.';
  return error instanceof Error ? error.message : fallback;
}

export type PowderizerController = ReturnType<typeof usePowderizerController>;
export type PowderizerSubmitSuccessHandler = (config: BuilderConfig) => void | Promise<void>;
export type UsePowderizerControllerOptions = {
  onSubmitSuccess?: PowderizerSubmitSuccessHandler;
};

/** Browser entropy adapter. Only used by legacy fallback components. */
export function cryptoRandom(): number {
  const values = new Uint32Array(1);
  globalThis.crypto.getRandomValues(values);
  return values[0]! / 0x1_0000_0000;
}

export function usePowderizerController({ onSubmitSuccess }: UsePowderizerControllerOptions = {}) {
  const { cart, cartId, isInitializing, refreshCart } = useCartContext();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [state, dispatch] = useReducer(powderizerReducer, undefined, initialPowderizerState);
  const [remote, setRemote] = useState<{
    data: PowderizerConfigResponse | null;
    error: string | null;
  }>({ data: null, error: null });
  const [configLoadError, setConfigLoadError] = useState<string | null>(null);
  const hydratedEditRef = useRef<string | null>(null);
  const quoteRequestRef = useRef(0);
  const editMixId = searchParams.get('edit');
  const validationError = useMemo(() => validateBuilderConfig(state.config), [state.config]);
  const quoteKey = useMemo(() => builderQuoteKey(state.config), [state.config]);

  useEffect(() => {
    const controller = new AbortController();
    void getCustomPowderConfig(controller.signal)
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
      void quoteCustomPowderMix(toPowderMixConfigInput(state.config), controller.signal)
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

  const replaceConfig = useCallback((source: BuilderConfigSource) => {
    const config = normalizeBuilderConfig(source);
    const error = validateBuilderConfig(config);
    if (error) {
      setConfigLoadError(error);
      return false;
    }
    setConfigLoadError(null);
    dispatch({ type: 'config-replaced', config });
    return true;
  }, []);

  const hasCurrentQuote = state.quote.status === 'ready' && state.quote.key === quoteKey;
  const canSubmit = !validationError && hasCurrentQuote && state.mutation.status !== 'submitting';

  const submit = useCallback(async () => {
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
      const submittedConfig = normalizeBuilderConfig(state.config);
      const body = toPowderMixConfigInput(submittedConfig);
      if (state.editMixId) await updateCustomPowderMix(cartId, state.editMixId, body);
      else await createCustomPowderMix(cartId, body);
      try {
        await onSubmitSuccess?.(submittedConfig);
      } catch {
        // Local history failures must not change a successful cart mutation outcome.
      }
      await refreshCart();
      dispatch({ type: 'mutation-finished' });
      navigate('/cart');
    } catch (error) {
      dispatch({ type: 'mutation-failed', error: messageFor(error, 'Unable to save this mix.') });
    }
  }, [canSubmit, cartId, navigate, onSubmitSuccess, refreshCart, state.config, state.editMixId]);

  return {
    state,
    dispatch,
    powderizerConfig: remote.data,
    remoteError: remote.error,
    configLoadError,
    validationError,
    hasCurrentQuote,
    canSubmit,
    replaceConfig,
    submit,
  };
}
