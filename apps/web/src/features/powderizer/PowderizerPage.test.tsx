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
}): PowderMixQuote {
  return {
    priceVersion: 'powderizer-v1',
    config: { ...body, customLabel: body.customLabel?.trim() || null },
    allocations: body.components.map((component) => ({
      ...component,
      allocatedGrams: (body.bagSizeGrams * component.percentage) / 100,
    })),
    packagingFeeCents: 400,
    finenessSurchargeCents: 0,
    unitPriceCents: 1400,
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
  await user.click(screen.getAllByRole('button', { name: 'Add' })[0]!);
  fireEvent.change(screen.getByLabelText('Protein Powder percentage'), { target: { value: '50' } });
  fireEvent.change(screen.getByLabelText('Cocoa Powder percentage'), { target: { value: '50' } });
}

describe('PowderizerPage', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
    vi.mocked(getPowderizerConfig).mockResolvedValue(config);
    vi.mocked(quotePowderMix).mockImplementation((body) => Promise.resolve(quoteFrom(body)));
    vi.mocked(useCartContext).mockReturnValue(cartContext(emptyCart));
  });

  it('blocks 99% and 101% totals, then creates only after a current quote', async () => {
    const user = userEvent.setup();
    vi.mocked(createPowderMix).mockResolvedValue(emptyCart);
    renderPage();
    await screen.findByRole('heading', { name: 'Powderizer' });
    await addValidComponents(user);
    fireEvent.change(screen.getByLabelText('Protein Powder percentage'), {
      target: { value: '98' },
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Ratios must total 100%.');
    expect(screen.getByRole('button', { name: 'Add to cart' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Protein Powder percentage'), {
      target: { value: '100' },
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Ratios must total 100%.');
    fireEvent.change(screen.getByLabelText('Protein Powder percentage'), {
      target: { value: '50' },
    });
    await waitFor(() => expect(quotePowderMix).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add to cart' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Add to cart' }));
    await waitFor(() =>
      expect(createPowderMix).toHaveBeenCalledWith(
        cartId,
        expect.objectContaining({
          components: [
            { productId: '1', percentage: 50 },
            { productId: '2', percentage: 50 },
          ],
        }),
      ),
    );
    expect(screen.getByText('Cart destination')).toBeInTheDocument();
  });

  it('hydrates edit state and submits an update for the existing mix', async () => {
    const user = userEvent.setup();
    vi.mocked(useCartContext).mockReturnValue(
      cartContext({
        ...emptyCart,
        mixItems: [
          {
            mixId,
            components: [
              {
                productId: '1',
                productName: 'Protein Powder',
                percentage: 50,
                allocatedGrams: 250,
              },
              { productId: '2', productName: 'Cocoa Powder', percentage: 50, allocatedGrams: 250 },
            ],
            bagSizeGrams: 500,
            fineness: 'standard',
            customLabel: 'Training',
            priceVersion: 'powderizer-v1',
            unitPriceCents: 1400,
            quantity: 1,
            lineTotalCents: 1400,
          },
        ],
      }),
    );
    vi.mocked(updatePowderMix).mockResolvedValue(emptyCart);
    renderPage(`/powderizer?edit=${mixId}`);
    await screen.findByText('Editing custom mix');
    await waitFor(() => expect(quotePowderMix).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Update cart' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Update cart' }));
    await waitFor(() =>
      expect(updatePowderMix).toHaveBeenCalledWith(
        cartId,
        mixId,
        expect.objectContaining({ customLabel: 'Training' }),
      ),
    );
    expect(screen.getByText('Cart destination')).toBeInTheDocument();
  });

  it('retries a failed quote and moves focus to a newly added ratio input', async () => {
    const user = userEvent.setup();
    vi.mocked(quotePowderMix)
      .mockRejectedValueOnce(new Error('Quote unavailable'))
      .mockImplementation((body) => Promise.resolve(quoteFrom(body)));
    renderPage();
    await screen.findByRole('heading', { name: 'Powderizer' });
    await user.click(screen.getAllByRole('button', { name: 'Add' })[0]!);
    await waitFor(() => expect(screen.getByLabelText('Protein Powder percentage')).toHaveFocus());
    await user.click(screen.getAllByRole('button', { name: 'Add' })[0]!);
    fireEvent.change(screen.getByLabelText('Protein Powder percentage'), {
      target: { value: '50' },
    });
    fireEvent.change(screen.getByLabelText('Cocoa Powder percentage'), { target: { value: '50' } });
    expect(await screen.findByRole('button', { name: 'Retry quote' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry quote' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add to cart' })).toBeEnabled());
  });
});
