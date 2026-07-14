import type {
  PowderMixCartItem,
  PowderMixConfigInput,
  PowderMixQuote,
} from '@shop/contracts/powderizer';

export type BuilderComponent = { productId: string; percentage: number };
export type BuilderConfig = {
  components: BuilderComponent[];
  bagSizeGrams: 250 | 500 | 1000;
  fineness: 'coarse' | 'standard' | 'fine';
  customLabel: string;
};

export type QuoteState =
  | { status: 'idle'; key: null; requestId: null; quote: null; error: null }
  | { status: 'loading'; key: string; requestId: number; quote: null; error: null }
  | { status: 'ready'; key: string; requestId: number; quote: PowderMixQuote; error: null }
  | { status: 'error'; key: string; requestId: number; quote: null; error: string };

export type MutationState = { status: 'idle' | 'submitting' | 'error'; error: string | null };

export type PowderizerState = {
  config: BuilderConfig;
  quote: QuoteState;
  mutation: MutationState;
  editMixId: string | null;
  editError: string | null;
  quoteRetry: number;
};

export type PowderizerEvent =
  | { type: 'component-added'; productId: string }
  | { type: 'component-removed'; productId: string }
  | { type: 'percentage-changed'; productId: string; percentage: number }
  | { type: 'equal-split' }
  | { type: 'bag-size-changed'; bagSizeGrams: BuilderConfig['bagSizeGrams'] }
  | { type: 'fineness-changed'; fineness: BuilderConfig['fineness'] }
  | { type: 'label-changed'; customLabel: string }
  | { type: 'edit-hydrated'; item: PowderMixCartItem }
  | { type: 'edit-missing'; mixId: string }
  | { type: 'edit-cleared' }
  | { type: 'quote-started'; key: string; requestId: number }
  | { type: 'quote-succeeded'; key: string; requestId: number; quote: PowderMixQuote }
  | { type: 'quote-failed'; key: string; requestId: number; error: string }
  | { type: 'quote-retry-requested' }
  | { type: 'mutation-started' }
  | { type: 'mutation-failed'; error: string }
  | { type: 'mutation-finished' };

export function initialPowderizerState(): PowderizerState {
  return {
    config: { components: [], bagSizeGrams: 500, fineness: 'standard', customLabel: '' },
    quote: { status: 'idle', key: null, requestId: null, quote: null, error: null },
    mutation: { status: 'idle', error: null },
    editMixId: null,
    editError: null,
    quoteRetry: 0,
  };
}

function clearQuote(state: PowderizerState, config: BuilderConfig): PowderizerState {
  return {
    ...state,
    config,
    quote: { status: 'idle', key: null, requestId: null, quote: null, error: null },
  };
}

export function powderizerReducer(state: PowderizerState, event: PowderizerEvent): PowderizerState {
  switch (event.type) {
    case 'component-added': {
      if (
        state.config.components.length >= 5 ||
        state.config.components.some(({ productId }) => productId === event.productId)
      )
        return state;
      return clearQuote(state, {
        ...state.config,
        components: [...state.config.components, { productId: event.productId, percentage: 1 }],
      });
    }
    case 'component-removed':
      return clearQuote(state, {
        ...state.config,
        components: state.config.components.filter(
          ({ productId }) => productId !== event.productId,
        ),
      });
    case 'percentage-changed':
      return clearQuote(state, {
        ...state.config,
        components: state.config.components.map((component) =>
          component.productId === event.productId
            ? { ...component, percentage: event.percentage }
            : component,
        ),
      });
    case 'equal-split':
      return clearQuote(state, {
        ...state.config,
        components: equalSplit(state.config.components),
      });
    case 'bag-size-changed':
      return clearQuote(state, { ...state.config, bagSizeGrams: event.bagSizeGrams });
    case 'fineness-changed':
      return clearQuote(state, { ...state.config, fineness: event.fineness });
    case 'label-changed':
      return clearQuote(state, { ...state.config, customLabel: event.customLabel });
    case 'edit-hydrated':
      return {
        ...clearQuote(state, {
          components: event.item.components.map(({ productId, percentage }) => ({
            productId,
            percentage,
          })),
          bagSizeGrams: event.item.bagSizeGrams,
          fineness: event.item.fineness,
          customLabel: event.item.customLabel ?? '',
        }),
        editMixId: event.item.mixId,
        editError: null,
      };
    case 'edit-missing':
      return {
        ...state,
        editMixId: event.mixId,
        editError: 'This custom mix is no longer in your cart.',
      };
    case 'edit-cleared':
      return initialPowderizerState();
    case 'quote-started':
      return {
        ...state,
        quote: {
          status: 'loading',
          key: event.key,
          requestId: event.requestId,
          quote: null,
          error: null,
        },
      };
    case 'quote-succeeded':
      if (
        state.quote.status !== 'loading' ||
        state.quote.key !== event.key ||
        state.quote.requestId !== event.requestId
      )
        return state;
      return {
        ...state,
        quote: {
          status: 'ready',
          key: event.key,
          requestId: event.requestId,
          quote: event.quote,
          error: null,
        },
      };
    case 'quote-failed':
      if (
        state.quote.status !== 'loading' ||
        state.quote.key !== event.key ||
        state.quote.requestId !== event.requestId
      )
        return state;
      return {
        ...state,
        quote: {
          status: 'error',
          key: event.key,
          requestId: event.requestId,
          quote: null,
          error: event.error,
        },
      };
    case 'quote-retry-requested':
      if (state.quote.status !== 'error') return state;
      return {
        ...state,
        quote: { status: 'idle', key: null, requestId: null, quote: null, error: null },
        quoteRetry: state.quoteRetry + 1,
      };
    case 'mutation-started':
      return { ...state, mutation: { status: 'submitting', error: null } };
    case 'mutation-failed':
      return { ...state, mutation: { status: 'error', error: event.error } };
    case 'mutation-finished':
      return { ...state, mutation: { status: 'idle', error: null } };
  }
}

export function equalSplit(components: BuilderComponent[]): BuilderComponent[] {
  if (components.length === 0) return components;
  const base = Math.floor(100 / components.length);
  const remainder = 100 % components.length;
  return components.map((component, index) => ({
    ...component,
    percentage: base + (index < remainder ? 1 : 0),
  }));
}

export function graphemeCount(value: string): number {
  const Segmenter = Intl.Segmenter;
  return Segmenter ? [...new Segmenter().segment(value)].length : [...value].length;
}

/** Browser-side feedback only. Server validation remains authoritative. */
export function validateBuilderConfig(config: BuilderConfig): string | null {
  if (config.components.length < 2 || config.components.length > 5)
    return 'Choose between 2 and 5 powders.';
  if (
    new Set(config.components.map(({ productId }) => productId)).size !== config.components.length
  )
    return 'Choose each powder only once.';
  if (config.components.some(({ percentage }) => !Number.isInteger(percentage) || percentage < 1))
    return 'Each ratio must be a positive whole number.';
  if (config.components.reduce((total, { percentage }) => total + percentage, 0) !== 100)
    return 'Ratios must total 100%.';
  if (![250, 500, 1000].includes(config.bagSizeGrams)) return 'Choose a valid bag size.';
  if (!['coarse', 'standard', 'fine'].includes(config.fineness)) return 'Choose a valid fineness.';
  const label = config.customLabel.trim().normalize('NFC');
  if (graphemeCount(label) > 40 || /[<>&\p{Cc}\p{Cf}]/u.test(label))
    return 'Label contains unsupported characters.';
  return null;
}

export function toPowderMixConfigInput(config: BuilderConfig): PowderMixConfigInput {
  return {
    components: [...config.components]
      .sort((left, right) => Number(left.productId) - Number(right.productId))
      .map(({ productId, percentage }) => ({ productId, percentage })),
    bagSizeGrams: config.bagSizeGrams,
    fineness: config.fineness,
    customLabel: config.customLabel,
  };
}

/** Stable quote identity; component display order does not affect server config. */
export function builderQuoteKey(config: BuilderConfig): string {
  return JSON.stringify(toPowderMixConfigInput(config));
}
