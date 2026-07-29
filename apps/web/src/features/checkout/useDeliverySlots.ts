import { useCallback, useEffect, useRef, useState } from 'react';
import type { DeliverySlotOptionsResponse } from '@shop/contracts/delivery';
import { ApiError } from '@/api/client';
import { getDeliverySlotOptions } from '@/api/deliverySlots';

export interface DeliverySlotsState {
  /** Server-offered slots plus the lead-time reason, or `null` before the first success. */
  options: DeliverySlotOptionsResponse | null;
  loading: boolean;
  /** Buyer-facing load failure, cleared by a successful reload. */
  error: string | null;
  reload: () => void;
}

function messageFor(error: unknown): string {
  if (error instanceof ApiError) return error.response?.error ?? error.message;
  if (error instanceof Error && error.message) return error.message;
  return 'Delivery slots are unavailable.';
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

/**
 * Loads the bookable delivery slots for the current cart.
 *
 * Lead time follows consignment weight, so a cart edit invalidates the offered list: the hook
 * refetches whenever the cart quote changes. Each request carries a generation number and an
 * `AbortController`, so a slow response for a superseded cart is both aborted and discarded and
 * can never repopulate the picker with slots derived from a stale consignment.
 *
 * @param cartId active cart, `null` while the cart is unavailable
 * @param quoteKey identity of the cart contents; a change re-derives the offered slots
 */
export function useDeliverySlots(cartId: string | null, quoteKey: string | null) {
  const [options, setOptions] = useState<DeliverySlotOptionsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const abort = useRef<AbortController | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!cartId) {
      setOptions(null);
      setLoading(false);
      setError(null);
      return;
    }
    const current = ++generation.current;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const response = await getDeliverySlotOptions(cartId, { signal: controller.signal });
        if (current !== generation.current) return;
        setOptions(response);
        setError(null);
      } catch (caught) {
        if (isAbort(caught) || current !== generation.current) return;
        setOptions(null);
        setError(messageFor(caught));
      } finally {
        if (current === generation.current) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [cartId, quoteKey, reloadToken]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  return { options, loading, error, reload } satisfies DeliverySlotsState;
}
