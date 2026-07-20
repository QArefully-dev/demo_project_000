import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Cart } from '@shop/contracts/cart';
import type { PowderMixQuote, PowderizerConfigResponse } from '@shop/contracts/powderizer';
import { getCustomPowderConfig, quoteCustomPowderMix } from '@/api/customPowder';
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

function product(id: string, category: string) {
  return { ...config.eligibleProducts[0]!, id, name: `Powder ${id}`, category, slug: id };
}
const expandedConfig: PowderizerConfigResponse = {
  ...config,
  eligibleProducts: [
    ...Array.from({ length: 10 }, (_, index) => product(`pantry-${index + 1}`, 'Pantry Staples')),
    product('performance-1', 'Performance'),
    product('drinks-1', 'Drinks'),
  ],
  dailyRecipe: {
    ...config.dailyRecipe,
    config: {
      ...config.dailyRecipe.config,
      components: [
        { productId: 'pantry-1', percentage: 40 },
        { productId: 'performance-1', percentage: 60 },
      ],
    },
  },
};

function cartContext(): ReturnType<typeof useCartContext> {
  return {
    cart: emptyCart,
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
function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/custom-powder']}>
      <Routes>
        <Route path="/custom-powder" element={<PowderizerPage />} />
        <Route path="/cart" element={<p>Cart destination</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Custom Powder Page', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
    vi.mocked(getCustomPowderConfig).mockResolvedValue(config);
    vi.mocked(quoteCustomPowderMix).mockImplementation((body) => Promise.resolve(quoteFrom(body)));
    vi.mocked(useCartContext).mockReturnValue(cartContext());
  });

  it('retries a failed quote and moves focus to a newly added ratio input', async () => {
    const user = userEvent.setup();
    vi.mocked(quoteCustomPowderMix)
      .mockRejectedValueOnce(new Error('Quote unavailable'))
      .mockImplementation((body) => Promise.resolve(quoteFrom(body)));
    renderPage();
    await screen.findByRole('heading', { name: 'Custom Powder' });
    const addButtons = screen.getAllByRole('button', { name: 'Add' });
    await user.click(addButtons[0]!);
    await waitFor(() => expect(screen.getByLabelText(/Powder.*percentage/)).toHaveFocus());
    await user.click(screen.getByRole('button', { name: 'All powders' }));
    for (const btn of screen.getAllByRole('button', { name: 'Add' })) {
      if (!btn.hasAttribute('disabled')) {
        await user.click(btn);
        break;
      }
    }
    const ratioInputs = screen.getAllByLabelText(/percentage/);
    fireEvent.change(ratioInputs[0]!, { target: { value: '50' } });
    fireEvent.change(ratioInputs[1]!, { target: { value: '50' } });
    expect(await screen.findByRole('button', { name: 'Retry quote' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry quote' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add to cart' })).toBeEnabled());
  });

  it('paginates every product and keeps a selected product when its category is hidden', async () => {
    const user = userEvent.setup();
    vi.mocked(getCustomPowderConfig).mockResolvedValue(expandedConfig);
    renderPage();
    await screen.findByRole('heading', { name: 'Custom Powder' });
    expect(screen.getAllByRole('button', { name: 'Add' })).toHaveLength(8);
    await user.click(screen.getAllByRole('button', { name: 'Add' })[0]!);
    await user.click(screen.getByRole('button', { name: 'All powders' }));
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(screen.getByText(/Page 2 of 2/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Performance' }));
    expect(screen.getByText(/1 of 5 powders selected/)).toBeInTheDocument();
    expect(screen.getByText(/Page 1 of 1/)).toBeInTheDocument();
  });

  it('loads featured blend and mounts combined facts for valid selections', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('heading', { name: 'Custom Powder' });
    expect(screen.getByRole('heading', { name: 'Test recipe' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Use this blend' }));
    await waitFor(() => expect(quoteCustomPowderMix).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('heading', { name: 'Combined blend facts' })).toBeInTheDocument();
  });
});
