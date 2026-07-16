import { describe, expect, it } from 'vitest';
import type { BuilderConfig } from './powderizerState';
import {
  chaosFallback,
  chaosMixBuilderConfig,
  hasChaosConstraints,
  isChaosPoolFeasible,
  positiveIntegerPartition,
  randomizeBuilderConfig,
  unevenPositiveIntegerPartition,
  type GeneratedConfigOptions,
  type PowderizerRandomProduct,
} from './powderizerRandom';

const products: PowderizerRandomProduct[] = [
  { id: '1', category: 'Pantry Staples', priceCents: 100 },
  { id: '2', category: 'Performance', priceCents: 200 },
  { id: '3', category: 'Questionable', priceCents: 300 },
  { id: '4', category: 'Impossible', priceCents: 400 },
  { id: '5', category: 'Drinks', priceCents: 500 },
  { id: '6', category: 'Outdoors', priceCents: 600 },
];

const baseConfig: BuilderConfig = {
  components: [
    { productId: '1', percentage: 50 },
    { productId: '2', percentage: 50 },
  ],
  bagSizeGrams: 500,
  fineness: 'standard',
  bagColourScheme: 'ultraviolet-cyan',
  customLabel: 'Keep me',
};

function fixedRandom(...values: number[]) {
  let index = 0;
  return () => values[index++ % values.length]!;
}

function options(random = fixedRandom(0.2, 0.7, 0.4)): GeneratedConfigOptions {
  return {
    baseConfig,
    bagSizes: [250, 500, 1000],
    finenessValues: ['coarse', 'standard', 'fine'],
    bagColourSchemes: [
      'ultraviolet-cyan',
      'solar-flare',
      'deep-space',
      'acid-lilac',
      'monochrome-glitch',
    ],
    random,
  };
}

function equalPartitionRandom() {
  let call = 0;
  return () => {
    const index = 98 - call++;
    if (index === 79) return 3 / 80;
    if (index === 59) return 2 / 60;
    if (index === 39) return 1 / 40;
    if (index === 19) return 0;
    return 0.999;
  };
}

describe('powderizer random helpers', () => {
  it('creates positive integer partitions totaling 100', () => {
    const partition = positiveIntegerPartition(100, 5, fixedRandom(0.1, 0.3, 0.5, 0.7));
    expect(partition).toHaveLength(5);
    expect(partition.every((value) => Number.isInteger(value) && value > 0)).toBe(true);
    expect(partition.reduce((total, value) => total + value, 0)).toBe(100);
  });

  it('makes an equal entropy partition uneven for Chaos Mix without breaking its total', () => {
    expect(positiveIntegerPartition(100, 5, equalPartitionRandom())).toEqual([20, 20, 20, 20, 20]);
    expect(unevenPositiveIntegerPartition(100, 5, equalPartitionRandom())).toEqual([
      19, 21, 20, 20, 20,
    ]);
  });

  it('randomizes a unique 2-5 product pool with deterministic injected entropy', () => {
    const generated = randomizeBuilderConfig(products, options(fixedRandom(0, 0.1, 0.2, 0.3, 0.4)));
    expect(generated.components).toHaveLength(2);
    expect(new Set(generated.components.map(({ productId }) => productId)).size).toBe(2);
    expect(generated.components.reduce((total, part) => total + part.percentage, 0)).toBe(100);
    expect(generated.customLabel).toBe('Keep me');
    expect(generated).toEqual(
      randomizeBuilderConfig(products, options(fixedRandom(0, 0.1, 0.2, 0.3, 0.4))),
    );
  });

  it('uses bounded retries then deterministic fallback for Chaos Mix constraints', () => {
    const fallback = chaosFallback(products);
    expect(fallback).toHaveLength(5);
    expect(hasChaosConstraints(fallback)).toBe(true);
    const chaos = chaosMixBuilderConfig(
      products,
      options(() => 0),
    );
    expect(chaos.components).toHaveLength(5);
    expect(new Set(chaos.components.map(({ productId }) => productId)).size).toBe(5);
    expect(
      hasChaosConstraints(
        chaos.components.map((part) => products.find(({ id }) => id === part.productId)!),
      ),
    ).toBe(true);
    expect(chaos.components.map(({ percentage }) => percentage)).not.toEqual([20, 20, 20, 20, 20]);
    expect(chaos.customLabel).toBe('Keep me');
  });

  it('rejects Chaos pools that cannot meet every hard constraint', () => {
    const noWeird = [
      ...products.filter(
        ({ category }) => category !== 'Questionable' && category !== 'Impossible',
      ),
      { id: '7', category: 'Household', priceCents: 700 },
    ];
    const twoCategories = products.slice(0, 5).map((product, index) => ({
      ...product,
      category: index === 0 ? 'Questionable' : 'Pantry Staples',
    }));
    const noPricedProduct = products
      .slice(0, 5)
      .map((product) => ({ ...product, priceCents: NaN }));
    for (const pool of [products.slice(0, 4), noWeird, twoCategories, noPricedProduct]) {
      expect(isChaosPoolFeasible(pool)).toBe(false);
      expect(() => chaosMixBuilderConfig(pool, options())).toThrow(/cannot satisfy/i);
    }
  });
});
