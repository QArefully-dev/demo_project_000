import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Cart } from '@shop/contracts/cart';
import type { PowderMixQuote, PowderizerConfigResponse } from '@shop/contracts/powderizer';
import {
  createPowderMix,
  getPowderizerConfig,
  quotePowderMix,
  updatePowderMix,
} from '@/api/powderizer';
import { useCartContext } from '@/hooks/CartContext';
import { PowderizerPage } from './PowderizerPage';
import { loadPowderizerHistory, POWDERIZER_HISTORY_KEY } from './powderizerHistory';

vi.mock('@/api/powderizer', () => ({
  createPowderMix: vi.fn(),
  getPowderizerConfig: vi.fn(),
  quotePowderMix: vi.fn(),
  updatePowderMix: vi.fn(),
}));
vi.mock('@/hooks/CartContext', () => ({ useCartContext: vi.fn() }));

const mixId = '01234567-89ab-4def-8123-456789abcdef';
const cartId = '01234567-89ab-4def-8123-456789abcdee';
const config: PowderizerConfigResponse = {
  eligibleProducts: [
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
  ],
  bagSizesGrams: [250, 500, 1000],
  finenessValues: ['coarse', 'standard', 'fine'],
  labelMaxGraphemes: 40,
  priceVersion: 'powderizer-v1',
  bagColourSchemes: [
    'ultraviolet-cyan',
    'solar-flare',
    'deep-space',
    'acid-lilac',
    'monochrome-glitch',
  ],
  defaultBagColourScheme: 'ultraviolet-cyan',
  dailyRecipe: {
    effectiveDate: '2026-07-15',
    name: 'Test recipe',
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
  },
};
const emptyCart: Cart = { id: cartId, items: [], mixItems: [], totalItems: 0, subtotalCents: 0 };

function cartContext(cart: Cart): ReturnType<typeof useCartContext> {
  return {
    cart,
    cartId,
    isCartAvailable: true,
    isLoading: false,
    isInitializing: false,
    error: null,
    pendingActions: {},
    isActionPending: () => false,
    addItem: vi.fn(),
    updateQuantity: vi.fn(),
    removeItem: vi.fn(),
    updateMixQuantity: vi.fn(),
    removeMix: vi.fn(),
    requoteMix: vi.fn(),
    refreshCart: vi.fn().mockResolvedValue(true),
    retryCart: vi.fn().mockResolvedValue(true),
    clearCart: vi.fn(),
  };
}

function quoteFrom(body: {
  components: { productId: string; percentage: number }[];
  bagSizeGrams: 250 | 500 | 1000;
  fineness: 'coarse' | 'standard' | 'fine';
  customLabel?: string;
  bagColourScheme?:
    'ultraviolet-cyan' | 'solar-flare' | 'deep-space' | 'acid-lilac' | 'monochrome-glitch';
}): PowderMixQuote {
  return {
    priceVersion: 'powderizer-v1',
    config: {
      ...body,
      customLabel: body.customLabel?.trim() || null,
      bagColourScheme: body.bagColourScheme ?? 'ultraviolet-cyan',
    },
    allocations: body.components.map((component) => ({
      ...component,
      allocatedGrams: (body.bagSizeGrams * component.percentage) / 100,
    })),
    packagingFeeCents: 400,
    finenessSurchargeCents: 0,
    unitPriceCents: 1400,
    usageLabel: 'Consumable powder',
  };
}

function renderPage(initialEntry = '/powderizer') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/powderizer" element={<PowderizerPage />} />
        <Route path="/cart" element={<p>Cart destination</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function addValidComponents(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getAllByRole('button', { name: 'Add' })[0]!);
  await user.click(screen.getByRole('button', { name: 'Performance' }));
  await user.click(screen.getAllByRole('button', { name: 'Add' })[0]!);
  fireEvent.change(screen.getByLabelText('Protein Powder percentage'), { target: { value: '50' } });
  fireEvent.change(screen.getByLabelText('Cocoa Powder percentage'), { target: { value: '50' } });
}

function editingCart(customLabel: string): Cart {
  return {
    ...emptyCart,
    mixItems: [
      {
        mixId,
        components: [
          { productId: '1', productName: 'Protein Powder', percentage: 50, allocatedGrams: 250 },
          { productId: '2', productName: 'Cocoa Powder', percentage: 50, allocatedGrams: 250 },
        ],
        bagSizeGrams: 500,
        fineness: 'standard',
        customLabel,
        bagColourScheme: 'ultraviolet-cyan',
        usageLabel: 'Consumable powder',
        priceVersion: 'powderizer-v1',
        unitPriceCents: 1400,
        quantity: 1,
        lineTotalCents: 1400,
      },
    ],
  };
}

describe('Powderizer history page', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
    window.localStorage.clear();
    vi.mocked(getPowderizerConfig).mockResolvedValue(config);
    vi.mocked(quotePowderMix).mockImplementation((body) => Promise.resolve(quoteFrom(body)));
    vi.mocked(useCartContext).mockReturnValue(cartContext(emptyCart));
  });

  it('records one successful create without price authority', async () => {
    const user = userEvent.setup();
    vi.mocked(createPowderMix).mockResolvedValue(emptyCart);
    renderPage();
    await screen.findByRole('heading', { name: 'Powderizer' });
    await addValidComponents(user);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add to cart' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Add to cart' }));
    expect(await screen.findByText('Cart destination')).toBeInTheDocument();
    const saved = loadPowderizerHistory(window.localStorage, config.eligibleProducts);
    expect(saved.entries).toHaveLength(1);
    expect(JSON.stringify(saved)).not.toContain('price');
  });

  it('does not record failure and storage failure does not block navigation', async () => {
    const user = userEvent.setup();
    vi.mocked(createPowderMix).mockRejectedValueOnce(new Error('Save unavailable'));
    renderPage();
    await screen.findByRole('heading', { name: 'Powderizer' });
    await addValidComponents(user);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add to cart' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Add to cart' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Save unavailable');
    expect(window.localStorage.getItem(POWDERIZER_HISTORY_KEY)).toBeNull();
    vi.mocked(createPowderMix).mockResolvedValueOnce(emptyCart);
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage unavailable');
    });
    await user.click(screen.getByRole('button', { name: 'Add to cart' }));
    expect(await screen.findByText('Cart destination')).toBeInTheDocument();
    setItem.mockRestore();
  });

  it('records exactly one successful update', async () => {
    const user = userEvent.setup();
    vi.mocked(useCartContext).mockReturnValue(cartContext(editingCart('Training')));
    vi.mocked(updatePowderMix).mockResolvedValue(emptyCart);
    renderPage(`/powderizer?edit=${mixId}`);
    await screen.findByText('Editing custom mix');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Update cart' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Update cart' }));
    expect(await screen.findByText('Cart destination')).toBeInTheDocument();
    const saved = loadPowderizerHistory(window.localStorage, config.eligibleProducts);
    expect(saved.entries).toHaveLength(1);
    expect(saved.entries[0]).toMatchObject({ config: { customLabel: 'Training' } });
  });

  it('uses history as fresh config without restoring edit state or stored price', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(
      POWDERIZER_HISTORY_KEY,
      JSON.stringify({
        version: 1,
        entries: [
          {
            storageVersion: 1,
            timestamp: '2026-07-15T09:00:00.000Z',
            quoteKey: 'old-history-key',
            config: {
              components: [
                { productId: '1', percentage: 25 },
                { productId: '2', percentage: 75 },
              ],
              bagSizeGrams: 250,
              fineness: 'fine',
              customLabel: 'From history',
              bagColourScheme: 'solar-flare',
            },
            componentNames: { 1: 'Old protein', 2: 'Old cocoa' },
            goodFor: 'Sleep',
            unitPriceCents: 99999,
          },
        ],
      }),
    );
    vi.mocked(useCartContext).mockReturnValue(cartContext(editingCart('Editing label')));
    renderPage(`/powderizer?edit=${mixId}`);
    await screen.findByText('Editing custom mix');
    await waitFor(() => expect(quotePowderMix).toHaveBeenCalled());
    const before = vi.mocked(quotePowderMix).mock.calls.length;
    await user.click(await screen.findByRole('button', { name: 'Use again' }));
    expect(await screen.findByText('New custom mix')).toBeInTheDocument();
    expect(screen.getByLabelText(/Bag label/)).toHaveValue('From history');
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('heading', { name: 'Powderizer' }).closest('section'),
      ),
    );
    await waitFor(() => expect(quotePowderMix).toHaveBeenCalledTimes(before + 1));
    const freshQuote = vi.mocked(quotePowderMix).mock.calls.at(-1)?.[0];
    expect(freshQuote).toMatchObject({
      components: [
        { productId: '1', percentage: 25 },
        { productId: '2', percentage: 75 },
      ],
      bagSizeGrams: 250,
      fineness: 'fine',
      customLabel: 'From history',
      bagColourScheme: 'solar-flare',
    });
    expect(freshQuote).not.toHaveProperty('unitPriceCents');
  });
});
