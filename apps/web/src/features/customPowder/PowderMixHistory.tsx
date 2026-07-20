import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  POWDER_MIX_BAG_COLOUR_SCHEME_VALUES,
  type PowderMixBagColourScheme,
} from '@shop/contracts/powderizer';
import type { Product } from '@shop/contracts/products';
import {
  normalizeBuilderConfig,
  validateBuilderConfig,
  builderQuoteKey,
  type BuilderConfig,
} from '../powderizer/powderizerState';

const OLD_HISTORY_KEY = 'powderizer:history:v1';
const NEW_HISTORY_KEY = 'customPowder:history:v1';
const HISTORY_VERSION = 1;
const HISTORY_LIMIT = 8;

export type CustomPowderHistoryEntry = {
  storageVersion: typeof HISTORY_VERSION;
  timestamp: string;
  quoteKey: string;
  config: BuilderConfig;
  componentNames: Record<string, string>;
};

type StoredHistory = {
  version: typeof HISTORY_VERSION;
  entries: CustomPowderHistoryEntry[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isConfig(value: unknown): value is BuilderConfig {
  if (!isRecord(value) || !Array.isArray(value.components)) return false;
  if (
    !value.components.every(
      (component) =>
        isRecord(component) &&
        typeof component.productId === 'string' &&
        Number.isInteger(component.percentage),
    ) ||
    (value.bagSizeGrams !== 250 && value.bagSizeGrams !== 500 && value.bagSizeGrams !== 1000) ||
    (value.fineness !== 'coarse' && value.fineness !== 'standard' && value.fineness !== 'fine') ||
    typeof value.customLabel !== 'string' ||
    !POWDER_MIX_BAG_COLOUR_SCHEME_VALUES.includes(value.bagColourScheme as PowderMixBagColourScheme)
  )
    return false;
  return validateBuilderConfig(normalizeBuilderConfig(value as BuilderConfig)) === null;
}

function parseEntry(
  value: unknown,
  productsById: ReadonlyMap<string, Product>,
): CustomPowderHistoryEntry | null {
  if (!isRecord(value) || value.storageVersion !== HISTORY_VERSION) return null;
  if (
    typeof value.timestamp !== 'string' ||
    Number.isNaN(Date.parse(value.timestamp)) ||
    typeof value.quoteKey !== 'string' ||
    !isConfig(value.config) ||
    !isRecord(value.componentNames) ||
    !Object.values(value.componentNames).every((name) => typeof name === 'string')
  )
    return null;
  const config = normalizeBuilderConfig(value.config);
  if (config.components.some(({ productId }) => !productsById.has(productId))) return null;
  return {
    storageVersion: HISTORY_VERSION,
    timestamp: value.timestamp,
    quoteKey: builderQuoteKey(config),
    config,
    componentNames: Object.fromEntries(
      config.components.map(({ productId }) => [productId, productsById.get(productId)!.name]),
    ),
  };
}

function parseStoredHistory(
  raw: string | null,
  products: readonly Product[],
): CustomPowderHistoryEntry[] {
  if (raw === null) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value) || value.version !== HISTORY_VERSION || !Array.isArray(value.entries))
      return [];
    const productsById = new Map(products.map((product) => [product.id, product]));
    const seen = new Set<string>();
    return value.entries
      .map((entry) => parseEntry(entry, productsById))
      .filter(
        (entry): entry is CustomPowderHistoryEntry =>
          entry !== null && !seen.has(entry.quoteKey) && (seen.add(entry.quoteKey), true),
      )
      .slice(0, HISTORY_LIMIT);
  } catch {
    return [];
  }
}

function migrateOldHistory(products: readonly Product[]): {
  entries: CustomPowderHistoryEntry[];
  migrated: boolean;
  discarded: number;
} {
  try {
    const raw = window.localStorage.getItem(OLD_HISTORY_KEY);
    if (!raw) return { entries: [], migrated: false, discarded: 0 };
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value) || value.version !== HISTORY_VERSION || !Array.isArray(value.entries))
      return { entries: [], migrated: true, discarded: 0 };
    const productsById = new Map(products.map((product) => [product.id, product]));
    const seen = new Set<string>();
    let discarded = 0;
    const entries = value.entries
      .map((entry) => {
        const result = parseEntry(entry, productsById);
        if (!result) discarded += 1;
        return result;
      })
      .filter(
        (entry): entry is CustomPowderHistoryEntry =>
          entry !== null && !seen.has(entry.quoteKey) && (seen.add(entry.quoteKey), true),
      )
      .slice(0, HISTORY_LIMIT);
    return { entries, migrated: true, discarded };
  } catch {
    return { entries: [], migrated: true, discarded: 0 };
  }
}

function saveHistory(entries: readonly CustomPowderHistoryEntry[]): boolean {
  const history: StoredHistory = { version: HISTORY_VERSION, entries: [...entries] };
  try {
    window.localStorage.setItem(NEW_HISTORY_KEY, JSON.stringify(history));
    return true;
  } catch {
    return false;
  }
}

function addEntry(
  entries: readonly CustomPowderHistoryEntry[],
  entry: CustomPowderHistoryEntry,
): CustomPowderHistoryEntry[] {
  return [entry, ...entries.filter(({ quoteKey }) => quoteKey !== entry.quoteKey)].slice(
    0,
    HISTORY_LIMIT,
  );
}

function schemeLabel(value: PowderMixBagColourScheme): string {
  return value.replaceAll('-', ' ');
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
}

type PowderMixHistoryProps = {
  entries: readonly CustomPowderHistoryEntry[];
  available: boolean;
  migrationNotice: string | null;
  onUseAgain: (entry: CustomPowderHistoryEntry) => void;
  onRemove: (quoteKey: string) => void;
  onClear: () => void;
};

export function PowderMixHistory({
  entries,
  available,
  migrationNotice,
  onUseAgain,
  onRemove,
  onClear,
}: PowderMixHistoryProps) {
  return (
    <section
      aria-labelledby="custom-powder-history-heading"
      className="space-y-3 rounded-lg border border-border p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 id="custom-powder-history-heading" className="font-semibold">
            Recent blends
          </h2>
          <p className="text-sm text-muted-foreground">Saved only in this browser.</p>
        </div>
        {entries.length > 0 && (
          <Button variant="outline" size="sm" onClick={onClear}>
            Clear history
          </Button>
        )}
      </div>
      {migrationNotice && (
        <p role="status" className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
          {migrationNotice}
        </p>
      )}
      {!available && (
        <p role="status" className="text-sm text-muted-foreground">
          Local history is unavailable in this browser session.
        </p>
      )}
      {entries.length === 0 && !migrationNotice ? (
        <p className="text-sm text-muted-foreground">
          No saved blends yet. Successful blends appear here.
        </p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No compatible blends found from your old history.
        </p>
      ) : (
        <ul className="space-y-3">
          {entries.map((entry) => (
            <li key={entry.quoteKey} className="rounded-md border border-border p-3">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <span
                  aria-hidden="true"
                  className="size-3 rounded-full border border-border"
                  style={{
                    background: `var(--powderizer-${entry.config.bagColourScheme}, currentColor)`,
                  }}
                />
                <span className="capitalize">{schemeLabel(entry.config.bagColourScheme)}</span>
                <time dateTime={entry.timestamp} className="text-muted-foreground">
                  {formatTimestamp(entry.timestamp)}
                </time>
              </div>
              <p className="mt-2 text-sm">
                {entry.config.components
                  .map(
                    ({ productId, percentage }) =>
                      `${entry.componentNames[productId]} ${percentage}%`,
                  )
                  .join(', ')}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {entry.config.bagSizeGrams}g · {entry.config.fineness}
              </p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={() => onUseAgain(entry)}>
                  Use again
                </Button>
                <Button variant="outline" size="sm" onClick={() => onRemove(entry.quoteKey)}>
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function useCustomPowderHistory(products: readonly Product[]) {
  const [history, setHistory] = useState<{
    entries: CustomPowderHistoryEntry[];
    available: boolean;
    migrationNotice: string | null;
  }>({ entries: [], available: false, migrationNotice: null });
  const [migrated, setMigrated] = useState(false);
  const migrationNoticeRef = useRef<string | null>(null);

  const productNames = new Map(products.map((product) => [product.id, product.name]));

  useEffect(() => {
    try {
      window.localStorage.getItem('test');
    } catch {
      setHistory({ entries: [], available: false, migrationNotice: null });
      return;
    }

    if (!migrated && products.length > 0) {
      const result = migrateOldHistory(products);
      if (result.migrated) {
        const notice =
          result.discarded > 0
            ? `Migrated ${result.entries.length} entries from old history; ${result.discarded} incompatible entries discarded.`
            : result.entries.length > 0
              ? `Migrated ${result.entries.length} entries from your previous history.`
              : 'No compatible entries found from your old history.';
        saveHistory(result.entries);
        window.localStorage.removeItem(OLD_HISTORY_KEY);
        migrationNoticeRef.current = notice;
        setHistory({ entries: result.entries, available: true, migrationNotice: notice });
        setMigrated(true);
        return;
      }
      setMigrated(true);
    }

    const raw = window.localStorage.getItem(NEW_HISTORY_KEY);
    setHistory({
      entries: parseStoredHistory(raw, products),
      available: true,
      migrationNotice: migrationNoticeRef.current,
    });
  }, [products, migrated]);

  const record = useCallback(
    (config: BuilderConfig) => {
      if (config.components.some(({ productId }) => !productNames.has(productId))) return;
      const entry: CustomPowderHistoryEntry = {
        storageVersion: HISTORY_VERSION,
        timestamp: new Date().toISOString(),
        quoteKey: builderQuoteKey(config),
        config: {
          ...config,
          components: config.components.map((component) => ({ ...component })),
        },
        componentNames: Object.fromEntries(
          config.components.map(({ productId }) => [productId, productNames.get(productId)!]),
        ),
      };
      setHistory((current) => {
        const entries = addEntry(current.entries, entry);
        saveHistory(entries);
        return { ...current, entries, migrationNotice: null };
      });
    },
    [productNames],
  );

  const remove = useCallback((quoteKey: string) => {
    setHistory((current) => {
      const entries = current.entries.filter((entry) => entry.quoteKey !== quoteKey);
      saveHistory(entries);
      return { ...current, entries };
    });
  }, []);

  const clear = useCallback(() => {
    try {
      window.localStorage.removeItem(NEW_HISTORY_KEY);
    } catch {
      // Storage unavailable — state still cleared.
    }
    setHistory((current) => ({ ...current, entries: [], migrationNotice: null }));
  }, []);

  return { ...history, record, remove, clear };
}
