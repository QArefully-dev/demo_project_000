import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Cart } from '@shop/contracts/cart';
import type { PowderMixQuote, PowderizerConfigResponse } from '@shop/contracts/powderizer';
import {
  createCustomPowderMix,
  getCustomPowderConfig,
  quoteCustomPowderMix,
  updateCustomPowderMix,
} from '@/api/customPowder';
import { useCartContext } from '@/hooks/CartContext';
import { PowderizerPage } from './PowderizerPage';

vi.mock('@/api/customPowder', () => ({
  createCustomPowderMix: vi.fn(),
  getCustomPowderConfig: vi.fn(),
  quoteCustomPowderMix: vi.fn(),
  updateCustomPowderMix: vi.fn(),
  requoteCustomPowderMix: vi.fn(),
  updateCustomPowderMixQuantity: vi.fn(),
  removeCustomPowderMix: vi.fn(),
}));
vi.mock('@/api/powderizer', () => ({
  createPowderMix: vi.fn(),
  getPowderizerConfig: vi.fn(),
  quotePowderMix: vi.fn(),
  updatePowderMix: vi.fn(),
  requotePowderMix: vi.fn(),
  updatePowderMixQuantity: vi.fn(),
  removePowderMix: vi.fn(),
}));
vi.mock('@/hooks/CartContext', () => ({ useCartContext: vi.fn() }));

const NEW_HISTORY_KEY = 'customPowder:history:v1';
const OLD_HISTORY_KEY = 'powderizer:history:v1';

const mixId = '01234567-89ab-4def-8123-456789abcdef';
const cartId = '01234567-89ab-4def-8123-456789abcdee';
const productMetadata = {
  createdAt: '2026-07-14T00:00:00.000Z',
  available: true,
  availability: 'in_stock' as const,
  backorderable: false,
  backorderLeadDays: null,
  tags: [],
  specificationGroups: [],
};
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
      ...productMetadata,
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
      ...productMetadata,
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
    addBundle: vi.fn(),
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

function renderPage(initialEntry = '/custom-powder') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/custom-powder" element={<PowderizerPage />} />
        <Route path="/cart" element={<p>Cart destination</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function addValidComponents(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getAllByRole('button', { name: 'Add' })[0]!);
  await user.click(screen.getByRole('button', { name: 'Performance' }));
  await waitFor(() => {
    const btns = screen.getAllByRole('button', { name: 'Add' });
    expect(btns.length).toBeGreaterThanOrEqual(1);
  });
  await user.click(screen.getAllByRole('button', { name: 'Add' })[0]!);
  const ratioInputs = screen.getAllByLabelText(/\w+ percentage/);
  fireEvent.change(ratioInputs[0]!, { target: { value: '50' } });
  fireEvent.change(ratioInputs[1]!, { target: { value: '50' } });
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

function parseSavedHistory(key: string) {
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

describe('Custom Powder history page', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
    window.localStorage.clear();
    vi.mocked(getCustomPowderConfig).mockResolvedValue(config);
    vi.mocked(quoteCustomPowderMix).mockImplementation((body) => Promise.resolve(quoteFrom(body)));
    vi.mocked(useCartContext).mockReturnValue(cartContext(emptyCart));
  });

  it('records one successful create', async () => {
    const user = userEvent.setup();
    vi.mocked(createCustomPowderMix).mockResolvedValue(emptyCart);
    renderPage();
    await screen.findByRole('heading', { name: 'Custom Powder' });
    await addValidComponents(user);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add to cart' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Add to cart' }));
    expect(await screen.findByText('Cart destination')).toBeInTheDocument();
    const saved = parseSavedHistory(NEW_HISTORY_KEY);
    expect(saved.entries).toHaveLength(1);
    expect(JSON.stringify(saved)).not.toContain('"goodFor"');
  });

  it('does not record failure and storage failure does not block navigation', async () => {
    const user = userEvent.setup();
    vi.mocked(createCustomPowderMix).mockRejectedValueOnce(new Error('Save unavailable'));
    renderPage();
    await screen.findByRole('heading', { name: 'Custom Powder' });
    await addValidComponents(user);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add to cart' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Add to cart' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Save unavailable');
    expect(window.localStorage.getItem(NEW_HISTORY_KEY)).toBeNull();
    vi.mocked(createCustomPowderMix).mockResolvedValueOnce(emptyCart);
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
    vi.mocked(updateCustomPowderMix).mockResolvedValue(emptyCart);
    renderPage(`/custom-powder?edit=${mixId}`);
    await screen.findByText('Editing custom blend');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Update cart' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Update cart' }));
    expect(await screen.findByText('Cart destination')).toBeInTheDocument();
    const saved = parseSavedHistory(NEW_HISTORY_KEY);
    expect(saved.entries).toHaveLength(1);
    expect(saved.entries[0]).toMatchObject({ config: { customLabel: 'Training' } });
  });

  it('migrates old history entries and uses them without edit state', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(
      OLD_HISTORY_KEY,
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
          },
        ],
      }),
    );
    vi.mocked(useCartContext).mockReturnValue(cartContext(editingCart('Editing label')));
    renderPage(`/custom-powder?edit=${mixId}`);
    await screen.findByText('Editing custom blend');
    await waitFor(() => expect(quoteCustomPowderMix).toHaveBeenCalled());
    const before = vi.mocked(quoteCustomPowderMix).mock.calls.length;
    expect(await screen.findByText(/Migrated 1 entries/)).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Use again' }));
    expect(await screen.findByText('New custom blend')).toBeInTheDocument();
    expect(screen.getByLabelText(/Bag label/)).toHaveValue('From history');
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('heading', { name: 'Custom Powder' }).closest('section'),
      ),
    );
    await waitFor(() => expect(quoteCustomPowderMix).toHaveBeenCalledTimes(before + 1));
    const freshQuote = vi.mocked(quoteCustomPowderMix).mock.calls.at(-1)?.[0];
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
  });
});
