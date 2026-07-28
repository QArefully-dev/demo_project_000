import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/AuthContext';
import { ApiError } from '@/api/client';
import {
  createBillingEntity,
  createDeliverySite,
  listBillingEntities,
  listDeliverySites,
  retireBillingEntity,
  retireDeliverySite,
  updateBillingEntity,
  updateDeliverySite,
} from '@/api/tradeAccount';
import type {
  BillingEntity,
  CreateBillingEntityBody,
  CreateDeliverySiteBody,
  DeliverySite,
  UpdateBillingEntityBody,
  UpdateDeliverySiteBody,
} from '@shop/contracts/trade-account';

/** Read state for one trade collection. `items` holds only active records. */
export interface TradeCollectionState<T> {
  items: T[];
  loading: boolean;
  /** Buyer-facing load failure. Cleared by a successful reload. */
  error: string | null;
}

export interface UseTradeProfileResult {
  deliverySites: TradeCollectionState<DeliverySite>;
  billingEntities: TradeCollectionState<BillingEntity>;
  reloadDeliverySites: () => void;
  reloadBillingEntities: () => void;
  /** Mutations reject with a buyer-facing `Error` so the calling form can show it inline. */
  addDeliverySite: (body: CreateDeliverySiteBody) => Promise<void>;
  editDeliverySite: (siteId: string, body: UpdateDeliverySiteBody) => Promise<void>;
  retireSite: (siteId: string) => Promise<void>;
  setDefaultDeliverySite: (siteId: string) => Promise<void>;
  addBillingEntity: (body: CreateBillingEntityBody) => Promise<void>;
  editBillingEntity: (entityId: string, body: UpdateBillingEntityBody) => Promise<void>;
  retireEntity: (entityId: string) => Promise<void>;
  setDefaultBillingEntity: (entityId: string) => Promise<void>;
}

function messageFor(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.response?.error ?? error.message ?? fallback;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

const EMPTY_STATE = { items: [], loading: false, error: null } as const;

/**
 * Owns the signed-in buyer's saved delivery sites and billing entities.
 *
 * Loads nothing while anonymous. Every list request carries a generation number and an
 * `AbortController`: a superseded response is both aborted and discarded, so a slow first load can
 * never overwrite the result of a later reload or of a mutation that already refreshed the list.
 */
export function useTradeProfile(): UseTradeProfileResult {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [deliverySites, setDeliverySites] = useState<TradeCollectionState<DeliverySite>>({
    ...EMPTY_STATE,
    items: [],
  });
  const [billingEntities, setBillingEntities] = useState<TradeCollectionState<BillingEntity>>({
    ...EMPTY_STATE,
    items: [],
  });

  const siteGeneration = useRef(0);
  const entityGeneration = useRef(0);
  const siteAbort = useRef<AbortController | null>(null);
  const entityAbort = useRef<AbortController | null>(null);

  const loadDeliverySites = useCallback(async () => {
    if (!userId) {
      setDeliverySites({ items: [], loading: false, error: null });
      return;
    }
    const generation = ++siteGeneration.current;
    siteAbort.current?.abort();
    const controller = new AbortController();
    siteAbort.current = controller;
    setDeliverySites((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const items = await listDeliverySites({ signal: controller.signal });
      if (generation !== siteGeneration.current) return;
      setDeliverySites({ items, loading: false, error: null });
    } catch (error) {
      if (generation !== siteGeneration.current || isAbort(error)) return;
      setDeliverySites({
        items: [],
        loading: false,
        error: messageFor(error, 'Unable to load delivery sites'),
      });
    }
  }, [userId]);

  const loadBillingEntities = useCallback(async () => {
    if (!userId) {
      setBillingEntities({ items: [], loading: false, error: null });
      return;
    }
    const generation = ++entityGeneration.current;
    entityAbort.current?.abort();
    const controller = new AbortController();
    entityAbort.current = controller;
    setBillingEntities((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const items = await listBillingEntities({ signal: controller.signal });
      if (generation !== entityGeneration.current) return;
      setBillingEntities({ items, loading: false, error: null });
    } catch (error) {
      if (generation !== entityGeneration.current || isAbort(error)) return;
      setBillingEntities({
        items: [],
        loading: false,
        error: messageFor(error, 'Unable to load billing details'),
      });
    }
  }, [userId]);

  useEffect(() => {
    void loadDeliverySites();
    void loadBillingEntities();
    return () => {
      // A later mount starts its own generation; abort keeps the stale socket from resolving.
      siteAbort.current?.abort();
      entityAbort.current?.abort();
    };
  }, [loadDeliverySites, loadBillingEntities]);

  const reloadDeliverySites = useCallback(() => void loadDeliverySites(), [loadDeliverySites]);
  const reloadBillingEntities = useCallback(
    () => void loadBillingEntities(),
    [loadBillingEntities],
  );

  async function runSiteMutation(action: () => Promise<unknown>, fallback: string): Promise<void> {
    try {
      await action();
    } catch (error) {
      throw new Error(messageFor(error, fallback));
    }
    await loadDeliverySites();
  }

  async function runEntityMutation(
    action: () => Promise<unknown>,
    fallback: string,
  ): Promise<void> {
    try {
      await action();
    } catch (error) {
      throw new Error(messageFor(error, fallback));
    }
    await loadBillingEntities();
  }

  return {
    deliverySites,
    billingEntities,
    reloadDeliverySites,
    reloadBillingEntities,
    addDeliverySite: (body) =>
      runSiteMutation(() => createDeliverySite(body), 'Unable to save delivery site'),
    editDeliverySite: (siteId, body) =>
      runSiteMutation(() => updateDeliverySite(siteId, body), 'Unable to update delivery site'),
    retireSite: (siteId) =>
      runSiteMutation(() => retireDeliverySite(siteId), 'Unable to remove delivery site'),
    setDefaultDeliverySite: (siteId) =>
      runSiteMutation(
        () => updateDeliverySite(siteId, { isDefault: true }),
        'Unable to set default delivery site',
      ),
    addBillingEntity: (body) =>
      runEntityMutation(() => createBillingEntity(body), 'Unable to save billing details'),
    editBillingEntity: (entityId, body) =>
      runEntityMutation(
        () => updateBillingEntity(entityId, body),
        'Unable to update billing details',
      ),
    retireEntity: (entityId) =>
      runEntityMutation(() => retireBillingEntity(entityId), 'Unable to remove billing details'),
    setDefaultBillingEntity: (entityId) =>
      runEntityMutation(
        () => updateBillingEntity(entityId, { isDefault: true }),
        'Unable to set default billing details',
      ),
  };
}
