import type { PowderMixBagColourScheme } from '@shop/contracts/powderizer';
import type { BuilderConfig, BuilderComponent } from './powderizerState';
import { validateBuilderConfig } from './powderizerState';

export type RandomSource = () => number;

export type PowderizerRandomProduct = {
  id: string;
  category: string;
  priceCents: number;
};

export type GeneratedConfigOptions = {
  baseConfig: BuilderConfig;
  bagSizes: readonly BuilderConfig['bagSizeGrams'][];
  finenessValues: readonly BuilderConfig['fineness'][];
  bagColourSchemes: readonly PowderMixBagColourScheme[];
  random: RandomSource;
};

function randomIndex(length: number, random: RandomSource): number {
  if (length < 1) throw new Error('Cannot select from an empty collection.');
  return Math.min(length - 1, Math.max(0, Math.floor(random() * length)));
}

/** Unbiased in-place Fisher-Yates over a copied input. */
export function fisherYates<T>(items: readonly T[], random: RandomSource): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = randomIndex(index + 1, random);
    [result[index], result[swapIndex]] = [result[swapIndex]!, result[index]!];
  }
  return result;
}

/** Uniformly chooses a positive integer partition by sampling unique cut points. */
export function positiveIntegerPartition(
  total: number,
  parts: number,
  random: RandomSource,
): number[] {
  if (!Number.isInteger(total) || !Number.isInteger(parts) || total < parts || parts < 1)
    throw new Error('Positive partition requires integer total >= parts >= 1.');
  const cuts = fisherYates(
    Array.from({ length: total - 1 }, (_, index) => index + 1),
    random,
  )
    .slice(0, parts - 1)
    .sort((left, right) => left - right);
  return [0, ...cuts, total].slice(1).map((cut, index) => cut - [0, ...cuts][index]!);
}

function generatedConfig(
  products: readonly PowderizerRandomProduct[],
  options: GeneratedConfigOptions,
  requireUnevenRatios = false,
): BuilderConfig {
  const ratios = requireUnevenRatios
    ? unevenPositiveIntegerPartition(100, products.length, options.random)
    : positiveIntegerPartition(100, products.length, options.random);
  const components: BuilderComponent[] = ratios.map((percentage, index) => ({
    productId: products[index]!.id,
    percentage,
  }));
  const config: BuilderConfig = {
    components,
    bagSizeGrams: options.bagSizes[randomIndex(options.bagSizes.length, options.random)]!,
    fineness: options.finenessValues[randomIndex(options.finenessValues.length, options.random)]!,
    bagColourScheme:
      options.bagColourSchemes[randomIndex(options.bagColourSchemes.length, options.random)]!,
    customLabel: options.baseConfig.customLabel,
  };
  const validationError = validateBuilderConfig(config);
  if (validationError) throw new Error(`Generated Powderizer config invalid: ${validationError}`);
  return config;
}

/** Keeps a positive partition valid while preventing a visually flat Chaos Mix. */
export function unevenPositiveIntegerPartition(
  total: number,
  parts: number,
  random: RandomSource,
): number[] {
  const partition = positiveIntegerPartition(total, parts, random);
  if (new Set(partition).size !== 1 || partition.length < 2 || partition[0] === 1) return partition;
  return partition.map((value, index) => {
    if (index === 0) return value - 1;
    if (index === 1) return value + 1;
    return value;
  });
}

export function randomizeBuilderConfig(
  pool: readonly PowderizerRandomProduct[],
  options: GeneratedConfigOptions,
): BuilderConfig {
  if (pool.length < 2) throw new Error('Randomize requires at least two products.');
  const count = 2 + randomIndex(Math.min(5, pool.length) - 1, options.random);
  return generatedConfig(fisherYates(pool, options.random).slice(0, count), options);
}

function topPriceQuartileIds(pool: readonly PowderizerRandomProduct[]): Set<string> {
  const pricedPool = pool.filter(({ priceCents }) => Number.isFinite(priceCents));
  if (pricedPool.length === 0) return new Set();
  const count = Math.max(1, Math.ceil(pricedPool.length / 4));
  return new Set(
    [...pricedPool]
      .sort((left, right) => right.priceCents - left.priceCents || left.id.localeCompare(right.id))
      .slice(0, count)
      .map(({ id }) => id),
  );
}

function meetsChaosConstraints(
  products: readonly PowderizerRandomProduct[],
  topQuartileIds: ReadonlySet<string>,
): boolean {
  return (
    products.length === 5 &&
    products.some(({ category }) => category === 'Questionable' || category === 'Impossible') &&
    new Set(products.map(({ category }) => category)).size >= 3 &&
    (topQuartileIds.size === 0 || products.some(({ id }) => topQuartileIds.has(id)))
  );
}

/** Deterministic constraint-first fallback for exhausted random retries. */
export function chaosFallback(pool: readonly PowderizerRandomProduct[]): PowderizerRandomProduct[] {
  const ordered = [...pool].sort((left, right) => left.id.localeCompare(right.id));
  const topQuartileIds = topPriceQuartileIds(pool);
  const required = [
    ordered.find(({ category }) => category === 'Questionable' || category === 'Impossible'),
    ordered.find(({ id }) => topQuartileIds.has(id)),
  ].filter((product): product is PowderizerRandomProduct => product !== undefined);
  const result: PowderizerRandomProduct[] = [];
  const add = (product: PowderizerRandomProduct | undefined) => {
    if (product && !result.some(({ id }) => id === product.id) && result.length < 5)
      result.push(product);
  };
  required.forEach(add);
  for (const product of ordered) {
    if (new Set(result.map(({ category }) => category)).has(product.category)) continue;
    add(product);
  }
  ordered.forEach(add);
  return result;
}

/** Checks every hard Chaos Mix condition before generation starts. */
export function isChaosPoolFeasible(pool: readonly PowderizerRandomProduct[]): boolean {
  return (
    pool.length >= 5 &&
    pool.some(({ category }) => category === 'Questionable' || category === 'Impossible') &&
    new Set(pool.map(({ category }) => category)).size >= 3 &&
    topPriceQuartileIds(pool).size > 0
  );
}

export function chaosMixBuilderConfig(
  pool: readonly PowderizerRandomProduct[],
  options: GeneratedConfigOptions,
): BuilderConfig {
  if (!isChaosPoolFeasible(pool))
    throw new Error('Chaos Mix pool cannot satisfy required constraints.');
  const topQuartileIds = topPriceQuartileIds(pool);
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const selected = fisherYates(pool, options.random).slice(0, 5);
    if (meetsChaosConstraints(selected, topQuartileIds))
      return generatedConfig(selected, options, true);
  }
  const fallback = chaosFallback(pool);
  if (!meetsChaosConstraints(fallback, topQuartileIds))
    throw new Error('Chaos Mix fallback cannot satisfy required constraints.');
  return generatedConfig(fallback, options, true);
}

export function hasChaosConstraints(products: readonly PowderizerRandomProduct[]): boolean {
  return meetsChaosConstraints(products, topPriceQuartileIds(products));
}
