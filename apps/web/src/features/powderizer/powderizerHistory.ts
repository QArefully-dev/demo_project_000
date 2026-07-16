import {
  POWDER_MIX_BAG_COLOUR_SCHEME_VALUES,
  type PowderMixBagColourScheme,
} from '@shop/contracts/powderizer';
import type { Product } from '@shop/contracts/products';
import {
  builderQuoteKey,
  normalizeBuilderConfig,
  validateBuilderConfig,
  type BuilderConfig,
} from './powderizerState';

export const POWDERIZER_HISTORY_KEY = 'powderizer:history:v1';
export const POWDERIZER_HISTORY_VERSION = 1;
export const POWDERIZER_HISTORY_LIMIT = 8;

export type PowderizerHistoryEntry = {
  storageVersion: typeof POWDERIZER_HISTORY_VERSION;
  timestamp: string;
  quoteKey: string;
  config: BuilderConfig;
  componentNames: Record<string, string>;
  goodFor: string;
};

type StoredHistory = {
  version: typeof POWDERIZER_HISTORY_VERSION;
  entries: PowderizerHistoryEntry[];
};

export type PowderizerHistoryStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type PowderizerHistoryLoad = {
  entries: PowderizerHistoryEntry[];
  available: boolean;
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
): PowderizerHistoryEntry | null {
  if (!isRecord(value) || value.storageVersion !== POWDERIZER_HISTORY_VERSION) return null;
  if (
    typeof value.timestamp !== 'string' ||
    Number.isNaN(Date.parse(value.timestamp)) ||
    typeof value.quoteKey !== 'string' ||
    typeof value.goodFor !== 'string' ||
    !isConfig(value.config) ||
    !isRecord(value.componentNames) ||
    !Object.values(value.componentNames).every((name) => typeof name === 'string')
  )
    return null;
  const config = normalizeBuilderConfig(value.config);
  if (config.components.some(({ productId }) => !productsById.has(productId))) return null;
  return {
    storageVersion: POWDERIZER_HISTORY_VERSION,
    timestamp: value.timestamp,
    quoteKey: builderQuoteKey(config),
    config,
    componentNames: Object.fromEntries(
      config.components.map(({ productId }) => [productId, productsById.get(productId)!.name]),
    ),
    goodFor: value.goodFor,
  };
}

function parseStoredHistory(
  raw: string | null,
  products: readonly Product[],
): PowderizerHistoryEntry[] {
  if (raw === null) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (
      !isRecord(value) ||
      value.version !== POWDERIZER_HISTORY_VERSION ||
      !Array.isArray(value.entries)
    )
      return [];
    const productsById = new Map(products.map((product) => [product.id, product]));
    const seen = new Set<string>();
    return value.entries
      .map((entry) => parseEntry(entry, productsById))
      .filter(
        (entry): entry is PowderizerHistoryEntry =>
          entry !== null && !seen.has(entry.quoteKey) && (seen.add(entry.quoteKey), true),
      )
      .slice(0, POWDERIZER_HISTORY_LIMIT);
  } catch {
    return [];
  }
}

export function loadPowderizerHistory(
  storage: PowderizerHistoryStorage | null | undefined,
  products: readonly Product[],
): PowderizerHistoryLoad {
  if (!storage) return { entries: [], available: false };
  try {
    return {
      entries: parseStoredHistory(storage.getItem(POWDERIZER_HISTORY_KEY), products),
      available: true,
    };
  } catch {
    return { entries: [], available: false };
  }
}

export function addPowderizerHistoryEntry(
  entries: readonly PowderizerHistoryEntry[],
  entry: PowderizerHistoryEntry,
): PowderizerHistoryEntry[] {
  return [entry, ...entries.filter(({ quoteKey }) => quoteKey !== entry.quoteKey)].slice(
    0,
    POWDERIZER_HISTORY_LIMIT,
  );
}

export function removePowderizerHistoryEntry(
  entries: readonly PowderizerHistoryEntry[],
  quoteKey: string,
): PowderizerHistoryEntry[] {
  return entries.filter((entry) => entry.quoteKey !== quoteKey);
}

export function savePowderizerHistory(
  storage: PowderizerHistoryStorage | null | undefined,
  entries: readonly PowderizerHistoryEntry[],
): boolean {
  if (!storage) return false;
  const history: StoredHistory = { version: POWDERIZER_HISTORY_VERSION, entries: [...entries] };
  try {
    storage.setItem(POWDERIZER_HISTORY_KEY, JSON.stringify(history));
    return true;
  } catch {
    return false;
  }
}

export function clearPowderizerHistory(
  storage: PowderizerHistoryStorage | null | undefined,
): boolean {
  if (!storage) return false;
  try {
    storage.removeItem(POWDERIZER_HISTORY_KEY);
    return true;
  } catch {
    return false;
  }
}
