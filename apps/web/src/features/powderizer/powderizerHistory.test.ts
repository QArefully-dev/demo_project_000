import { describe, expect, it } from 'vitest';
import type { Product } from '@shop/contracts/products';
import {
  addPowderizerHistoryEntry,
  clearPowderizerHistory,
  loadPowderizerHistory,
  POWDERIZER_HISTORY_KEY,
  POWDERIZER_HISTORY_LIMIT,
  savePowderizerHistory,
  type PowderizerHistoryEntry,
  type PowderizerHistoryStorage,
} from './powderizerHistory';

const products: Product[] = [
  {
    id: '1',
    name: 'Protein Powder',
    description: 'Protein',
    priceCents: 1200,
    imageSetId: 'protein',
    category: 'Performance',
    stock: 8,
    slug: 'protein',
    salesCount: 1,
    mixable: true,
    mixUnitGrams: 500,
  },
  {
    id: '2',
    name: 'Cocoa Powder',
    description: 'Cocoa',
    priceCents: 800,
    imageSetId: 'cocoa',
    category: 'Pantry Staples',
    stock: 8,
    slug: 'cocoa',
    salesCount: 1,
    mixable: true,
    mixUnitGrams: 250,
  },
];

function memoryStorage(): PowderizerHistoryStorage & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
    removeItem: (key) => void values.delete(key),
  };
}

function entry(index = 0): PowderizerHistoryEntry {
  return {
    storageVersion: 1,
    timestamp: `2026-07-${String(index + 1).padStart(2, '0')}T10:00:00.000Z`,
    quoteKey: `key-${index}`,
    config: {
      components: [
        { productId: '1', percentage: 50 },
        { productId: '2', percentage: 50 },
      ],
      bagSizeGrams: 500,
      fineness: 'standard',
      customLabel: '',
      bagColourScheme: index % 2 ? 'solar-flare' : 'ultraviolet-cyan',
    },
    componentNames: { 1: 'Old protein name', 2: 'Old cocoa name' },
    goodFor: 'Sleep',
  };
}

describe('powderizer history', () => {
  it('returns empty history for malformed JSON or an unknown storage version', () => {
    const storage = memoryStorage();
    storage.setItem(POWDERIZER_HISTORY_KEY, '{bad json');
    expect(loadPowderizerHistory(storage, products)).toEqual({ entries: [], available: true });
    storage.setItem(POWDERIZER_HISTORY_KEY, JSON.stringify({ version: 2, entries: [entry()] }));
    expect(loadPowderizerHistory(storage, products)).toEqual({ entries: [], available: true });
  });

  it('dedupes newest entries and caps at eight', () => {
    const entries = Array.from({ length: POWDERIZER_HISTORY_LIMIT }, (_, index) => entry(index));
    const duplicated = { ...entry(8), quoteKey: 'key-2' };
    const next = addPowderizerHistoryEntry(entries, duplicated);
    expect(next).toHaveLength(POWDERIZER_HISTORY_LIMIT);
    expect(next[0]).toBe(duplicated);
    expect(next.filter(({ quoteKey }) => quoteKey === 'key-2')).toHaveLength(1);
    expect(next.some(({ quoteKey }) => quoteKey === 'key-7')).toBe(true);
  });

  it('drops stored entries when their product no longer exists and resolves names from current products', () => {
    const storage = memoryStorage();
    expect(savePowderizerHistory(storage, [entry()])).toBe(true);
    const resolved = loadPowderizerHistory(storage, products);
    expect(resolved.entries[0]?.componentNames).toEqual({ 1: 'Protein Powder', 2: 'Cocoa Powder' });
    expect(loadPowderizerHistory(storage, products.slice(0, 1)).entries).toEqual([]);
  });

  it('contains no price fields and storage exceptions never escape', () => {
    const storage: PowderizerHistoryStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadPowderizerHistory(storage, products)).toEqual({ entries: [], available: false });
    expect(savePowderizerHistory(storage, [entry()])).toBe(false);
    expect(clearPowderizerHistory(storage)).toBe(false);
    expect(JSON.stringify(entry())).not.toContain('price');
  });
});
