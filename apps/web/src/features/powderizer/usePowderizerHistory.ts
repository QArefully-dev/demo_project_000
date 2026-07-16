import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Product } from '@shop/contracts/products';
import { selectGoodFor } from './powderizerCopy';
import {
  addPowderizerHistoryEntry,
  clearPowderizerHistory,
  loadPowderizerHistory,
  removePowderizerHistoryEntry,
  savePowderizerHistory,
  type PowderizerHistoryEntry,
  type PowderizerHistoryStorage,
} from './powderizerHistory';
import { builderQuoteKey, type BuilderConfig } from './powderizerState';

function browserStorage(): PowderizerHistoryStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function usePowderizerHistory(
  products: readonly Product[],
  storage: PowderizerHistoryStorage | null = browserStorage(),
) {
  const [history, setHistory] = useState(() => loadPowderizerHistory(storage, products));
  const productNames = useMemo(
    () => new Map(products.map((product) => [product.id, product.name])),
    [products],
  );

  useEffect(() => setHistory(loadPowderizerHistory(storage, products)), [products, storage]);

  const record = useCallback(
    (config: BuilderConfig) => {
      const goodFor = selectGoodFor(config);
      if (!goodFor || config.components.some(({ productId }) => !productNames.has(productId)))
        return;
      const entry: PowderizerHistoryEntry = {
        storageVersion: 1,
        timestamp: new Date().toISOString(),
        quoteKey: builderQuoteKey(config),
        config: {
          ...config,
          components: config.components.map((component) => ({ ...component })),
        },
        componentNames: Object.fromEntries(
          config.components.map(({ productId }) => [productId, productNames.get(productId)!]),
        ),
        goodFor,
      };
      setHistory((current) => {
        const entries = addPowderizerHistoryEntry(current.entries, entry);
        return { entries, available: savePowderizerHistory(storage, entries) && current.available };
      });
    },
    [productNames, storage],
  );

  const remove = useCallback(
    (quoteKey: string) => {
      setHistory((current) => {
        const entries = removePowderizerHistoryEntry(current.entries, quoteKey);
        return { entries, available: savePowderizerHistory(storage, entries) && current.available };
      });
    },
    [storage],
  );

  const clear = useCallback(() => {
    setHistory((current) => ({
      entries: [],
      available: clearPowderizerHistory(storage) && current.available,
    }));
  }, [storage]);

  return { ...history, record, remove, clear };
}
