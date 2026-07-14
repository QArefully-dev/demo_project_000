import { describe, expect, it } from 'vitest';
import type { PowderMixQuote } from '@shop/contracts/powderizer';
import {
  builderQuoteKey,
  initialPowderizerState,
  powderizerReducer,
  validateBuilderConfig,
} from './powderizerState';

const quote = {
  priceVersion: 'powderizer-v1',
  config: {
    components: [
      { productId: '1', percentage: 50 },
      { productId: '2', percentage: 50 },
    ],
    bagSizeGrams: 500,
    fineness: 'standard',
    customLabel: null,
    bagColourScheme: 'ultraviolet-cyan',
  },
  allocations: [
    { productId: '1', percentage: 50, allocatedGrams: 250 },
    { productId: '2', percentage: 50, allocatedGrams: 250 },
  ],
  packagingFeeCents: 400,
  finenessSurchargeCents: 0,
  unitPriceCents: 1400,
  usageLabel: 'Consumable powder',
} satisfies PowderMixQuote;

function withComponents(ids: readonly string[]) {
  return ids.reduce(
    (state, productId) => powderizerReducer(state, { type: 'component-added', productId }),
    initialPowderizerState(),
  );
}

describe('powderizerReducer', () => {
  it('adds and removes only unique 2-5 builder components', () => {
    let state = withComponents(['1', '2', '3', '4', '5', '5']);
    expect(state.config.components.map(({ productId }) => productId)).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
    ]);
    state = powderizerReducer(state, { type: 'component-added', productId: '6' });
    expect(state.config.components).toHaveLength(5);
    state = powderizerReducer(state, { type: 'component-removed', productId: '3' });
    expect(state.config.components.map(({ productId }) => productId)).toEqual(['1', '2', '4', '5']);
  });

  it('splits 100 by current display order', () => {
    for (const [ids, expected] of [
      [
        ['1', '2'],
        [50, 50],
      ],
      [
        ['1', '2', '3'],
        [34, 33, 33],
      ],
      [
        ['1', '2', '3', '4', '5'],
        [20, 20, 20, 20, 20],
      ],
    ] as const) {
      const state = powderizerReducer(withComponents(ids), { type: 'equal-split' });
      expect(state.config.components.map(({ percentage }) => percentage)).toEqual(expected);
    }
  });

  it('reports live invalid totals and clears stale quotes after config changes', () => {
    let state = withComponents(['1', '2']);
    state = powderizerReducer(state, {
      type: 'percentage-changed',
      productId: '1',
      percentage: 98,
    });
    expect(validateBuilderConfig(state.config)).toBe('Ratios must total 100%.');
    state = powderizerReducer(state, {
      type: 'percentage-changed',
      productId: '1',
      percentage: 99,
    });
    expect(validateBuilderConfig(state.config)).toBeNull();
    state = powderizerReducer(state, {
      type: 'percentage-changed',
      productId: '1',
      percentage: 100,
    });
    expect(validateBuilderConfig(state.config)).toBe('Ratios must total 100%.');
    state = powderizerReducer(state, {
      type: 'percentage-changed',
      productId: '1',
      percentage: 99,
    });
    const key = builderQuoteKey(state.config);
    state = powderizerReducer(state, { type: 'quote-started', key, requestId: 1 });
    state = powderizerReducer(state, { type: 'quote-succeeded', key, requestId: 1, quote });
    expect(state.quote.status).toBe('ready');
    state = powderizerReducer(state, { type: 'label-changed', customLabel: 'Fresh' });
    expect(state.quote.status).toBe('idle');
  });

  it('ignores stale quote responses', () => {
    let state = withComponents(['1', '2']);
    state = powderizerReducer(state, { type: 'equal-split' });
    state = powderizerReducer(state, { type: 'quote-started', key: 'new', requestId: 2 });
    state = powderizerReducer(state, { type: 'quote-succeeded', key: 'old', requestId: 1, quote });
    expect(state.quote.status).toBe('loading');
    state = powderizerReducer(state, { type: 'quote-succeeded', key: 'new', requestId: 2, quote });
    expect(state.quote.status).toBe('ready');
  });

  it('hydrates persisted edit configuration and reports missing targets', () => {
    const state = powderizerReducer(initialPowderizerState(), {
      type: 'edit-hydrated',
      item: {
        mixId: '01234567-89ab-4def-8123-456789abcdef',
        components: [
          { productId: '2', productName: 'Cocoa', percentage: 60, allocatedGrams: 300 },
          { productId: '1', productName: 'Protein', percentage: 40, allocatedGrams: 200 },
        ],
        bagSizeGrams: 500,
        fineness: 'fine',
        customLabel: 'Training blend',
        bagColourScheme: 'ultraviolet-cyan',
        usageLabel: 'Consumable powder',
        priceVersion: 'powderizer-v1',
        unitPriceCents: 1500,
        quantity: 1,
        lineTotalCents: 1500,
      },
    });
    expect(state.config).toMatchObject({
      bagSizeGrams: 500,
      fineness: 'fine',
      customLabel: 'Training blend',
    });
    expect(state.config.components.map(({ productId }) => productId)).toEqual(['2', '1']);
    const missing = powderizerReducer(state, { type: 'edit-missing', mixId: 'missing' });
    expect(missing.editError).toMatch(/no longer/i);
    expect(powderizerReducer(state, { type: 'edit-cleared' })).toEqual(initialPowderizerState());
  });

  it('clears a quote error and creates a distinct retry request', () => {
    let state = withComponents(['1', '2']);
    state = powderizerReducer(state, { type: 'equal-split' });
    state = powderizerReducer(state, { type: 'quote-started', key: 'config', requestId: 1 });
    state = powderizerReducer(state, {
      type: 'quote-failed',
      key: 'config',
      requestId: 1,
      error: 'Network failed',
    });
    state = powderizerReducer(state, { type: 'quote-retry-requested' });
    expect(state.quote).toMatchObject({ status: 'idle', error: null });
    expect(state.quoteRetry).toBe(1);
    state = powderizerReducer(state, { type: 'quote-started', key: 'config', requestId: 2 });
    state = powderizerReducer(state, {
      type: 'quote-succeeded',
      key: 'config',
      requestId: 1,
      quote,
    });
    expect(state.quote.status).toBe('loading');
  });
});
