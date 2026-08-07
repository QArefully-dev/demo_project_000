import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { CustomBlendOption, CustomBlendOptionsResponse } from '@shop/contracts/custom-blends';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCustomBlendOptions } from '@/api/customBlends';
import { useCartContext } from '@/hooks/CartContext';
import { useCategories } from '@/hooks/useCategories';
import { useProducts } from '@/hooks/useProducts';
import App from '@/App';

vi.mock('@/api/customBlends', () => ({
  getCustomBlendOptions: vi.fn(),
  createCustomBlend: vi.fn(),
  replaceCustomBlend: vi.fn(),
}));
vi.mock('@/hooks/CartContext', () => ({ useCartContext: vi.fn() }));
vi.mock('@/hooks/useProducts', () => ({ useProducts: vi.fn() }));
vi.mock('@/hooks/useCategories', () => ({ useCategories: vi.fn() }));

// The real Layout pulls the whole shell (header, auth, cart sheet). Reachability only needs the
// nav that owns the Custom Blend slot rendered above the real router.
vi.mock('@/components/Layout', async () => {
  const { Outlet } = await import('react-router-dom');
  const { CategoryNav } = await import('@/components/CategoryNav');

  return {
    Layout: () => (
      <>
        <CategoryNav />
        <Outlet />
      </>
    ),
  };
});

function option(
  variantId: number,
  productName: string,
  overrides: { stockCount?: number } = {},
): CustomBlendOption {
  return {
    productId: String(variantId),
    productName,
    productDescription: `${productName} description`,
    category: 'Trade & Creative Materials',
    consumptionClassification: 'non-food',
    categoryFacts: {
      texture: 'Fine powder',
      colour: 'Grey',
      source: 'Test source',
      intendedUse: 'Testing',
      storage: 'Dry and cool',
      consumptionClassification: 'non-food',
    },
    mixingGroup: 'mineral',
    variant: {
      variantId,
      productId: variantId,
      sku: `MAT-${variantId}`,
      label: '25 kg sack',
      weightGrams: 25_000,
      priceCents: 1_200,
      moqSacks: 4,
      perTonneCents: 48_000,
      priceTiers: [{ minTonnes: 1, discountPct: 0 }],
      stockCount: overrides.stockCount ?? 40,
      backorderable: false,
      backorderLeadDays: null,
      deliveryClass: 'freight',
      active: true,
      sortOrder: 1,
    },
  };
}

/** A catalog row the base picker can offer: the 25 kg sack variant is the only eligible base. */
const baseProduct = {
  id: '9',
  name: 'Portland Cement',
  variants: [{ variantId: 501, weightGrams: 25_000, active: true }],
};

const options: CustomBlendOptionsResponse = {
  base: option(501, 'Portland Cement'),
  ingredients: [option(601, 'Chalk Filler'), option(602, 'Silica Flour', { stockCount: 0 })],
};

function renderApp(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <App />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useCategories).mockReturnValue({
    categories: ['Trade & Creative Materials'],
    isLoading: false,
    error: null,
  });
  vi.mocked(useProducts).mockReturnValue({
    products: [baseProduct],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useProducts>);
  vi.mocked(useCartContext).mockReturnValue({
    cart: null,
    error: null,
    isCartAvailable: true,
    addCustomBlend: vi.fn().mockResolvedValue(true),
    replaceCustomBlend: vi.fn().mockResolvedValue(true),
    retryCart: vi.fn(),
  } as unknown as ReturnType<typeof useCartContext>);
  vi.mocked(getCustomBlendOptions).mockResolvedValue(options);
});

describe('custom blend reachability', () => {
  it('reaches the configurator from the nav link a customer can actually see', async () => {
    const user = userEvent.setup();

    // Starts on a static route so the assertion is about the nav reaching the configurator, not
    // about whatever page happened to be mounted underneath it. The help index also links the
    // Custom Blend article, so the click is scoped to the category nav.
    renderApp('/help');

    const nav = screen.getByRole('navigation', { name: 'Product categories' });
    await user.click(within(nav).getByRole('link', { name: 'Custom Blend' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Build a custom blend' }),
    ).toBeVisible();
    expect(screen.getByRole('heading', { level: 2, name: 'Base material' })).toBeInTheDocument();
  });

  it('honours a baseVariantId deep link and keeps sold-out ingredients selectable', async () => {
    const user = userEvent.setup();
    renderApp('/custom-blend?baseVariantId=501');

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Base material' }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(getCustomBlendOptions).toHaveBeenCalledWith(501, expect.anything());
    });

    // Inventory is advisory in Custom Blend; server-side validation remains authoritative.
    expect(screen.getByText('Out of stock')).toBeInTheDocument();
    const ingredient = screen.getByRole('checkbox', { name: 'Silica Flour' });
    expect(ingredient).toBeEnabled();
    await user.click(ingredient);
    expect(ingredient).toBeChecked();
  });

  it('rejects an unusable baseVariantId instead of rendering a broken configurator', async () => {
    renderApp('/custom-blend?baseVariantId=not-a-number');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That base material is not available for Custom Blend.',
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Base material' })).toBeInTheDocument();
  });

  it('serves the Custom Blend help article on its own route', async () => {
    renderApp('/help/custom-blend');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Custom Blend' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/flat blending fee of \$31\.25/)).toBeInTheDocument();
  });
});
