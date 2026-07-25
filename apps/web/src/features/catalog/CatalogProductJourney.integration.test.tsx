import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import type { ProductWithVariants, CategoryFacts } from '@shop/contracts/products';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getProduct, getSimilarProducts } from '@/api/products';
import { useCategories } from '@/hooks/useCategories';
import { useProductFilterOptions } from '@/hooks/useProductFilterOptions';
import { useProducts } from '@/hooks/useProducts';
import { CatalogPage } from './CatalogPage';
import { ProductPage } from '../product/ProductPage';
import { ComparisonSelectionProvider } from '@/features/comparison/ComparisonSelectionContext';

vi.mock('@/api/products', () => ({
  getProduct: vi.fn(),
  getSimilarProducts: vi.fn(),
}));
vi.mock('@/hooks/useProducts', () => ({ useProducts: vi.fn() }));
vi.mock('@/hooks/useCategories', () => ({ useCategories: vi.fn() }));
vi.mock('@/hooks/useProductFilterOptions', () => ({ useProductFilterOptions: vi.fn() }));
vi.mock('@/hooks/CartContext', () => ({
  useCartContext: () => ({
    error: null,
    addItem: vi.fn().mockResolvedValue(true),
    retryCart: vi.fn().mockResolvedValue(true),
    isCartAvailable: true,
    isActionPending: () => false,
  }),
}));
vi.mock('@/components/WishlistButton', () => ({
  WishlistButton: () => <button type="button">Wishlist</button>,
}));

const defaultFacts: CategoryFacts = {
  texture: 'Fine',
  colour: 'White',
  source: 'Test source',
  intendedUse: 'Testing',
  storage: 'Dry cool',
  consumptionClassification: 'non-food',
};

const catalogProduct: ProductWithVariants = {
  id: 'catalog-product',
  name: 'Powdered Water',
  description: 'Just-add-water water powder, 300g. Dry until required.',
  priceCents: 1000,
  imageSetId: 'powdered-water',
  category: 'Impossible',
  stock: 5,
  slug: 'powdered-water',
  salesCount: 0,
  createdAt: '2026-07-14T00:00:00.000Z',
  available: true,
  availability: 'in_stock',
  backorderable: false,
  backorderLeadDays: null,
  tags: [],
  specificationGroups: [],
  mixable: false,
  variants: [
    {
      variantId: 1,
      productId: 1,
      sku: 'PW-001',
      label: 'Standard',
      weightGrams: 500,
      priceCents: 1000,
      moqSacks: 4,
      perTonneCents: 2_000_000,
      priceTiers: [{ minTonnes: 1, discountPct: 0 }],
      stockCount: 5,
      backorderable: false,
      backorderLeadDays: null,
      deliveryClass: 'parcel',
      active: true,
      sortOrder: 1,
    },
  ],
  defaultVariantId: 1,
  categoryFacts: defaultFacts,
  consumptionClassification: 'non-food',
  mixingGroup: null,
  priceRange: { min: 1000, max: 1000 },
  baseAvailability: 'in_stock',
};

/**
 * Two canonical Trade & Creative Materials products. Same category, adjacent canonical ids, so the
 * per-category palette must give them different schemes on the catalog surface.
 */
function tradeProduct(id: string, name: string): ProductWithVariants {
  return {
    ...catalogProduct,
    id,
    name,
    slug: name.toLowerCase().replaceAll(' ', '-'),
    imageSetId: name.toLowerCase().replaceAll(' ', '-'),
    category: 'Trade & Creative Materials',
  };
}

function NavigationControls() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <output data-testid="location">{`${location.pathname}${location.search}`}</output>
      <button type="button" onClick={() => navigate(-1)}>
        Back
      </button>
    </>
  );
}

describe('catalog to product journey', () => {
  beforeEach(() => {
    vi.mocked(useCategories).mockReturnValue({
      categories: ['Impossible', 'Pantry Staples'],
      isLoading: false,
      error: null,
    });
    vi.mocked(useProducts).mockReturnValue({
      products: [catalogProduct],
      isLoading: false,
      error: null,
      total: 1,
      currentPage: 1,
      currentPageSize: 24,
      refetch: vi.fn().mockResolvedValue(undefined),
    });
    vi.mocked(getProduct).mockResolvedValue(catalogProduct);
    vi.mocked(getSimilarProducts).mockResolvedValue([]);
    vi.mocked(useProductFilterOptions).mockReturnValue({
      options: { tags: [], specificationGroups: [] },
      isLoading: false,
      error: null,
      refetch: vi.fn().mockResolvedValue(undefined),
    });
  });

  it('removes filter values absent from the loaded registry after navigation and browser back', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter
        initialEntries={[
          '/catalog?q=water&tag=pantry&tag=drink-mix&spec=texture%3Afine&sort=price_desc&page=2&pageSize=24',
        ]}
      >
        <ComparisonSelectionProvider
          storage={{ getItem: () => null, setItem: () => undefined, removeItem: () => undefined }}
        >
          <NavigationControls />
          <Routes>
            <Route path="/catalog" element={<CatalogPage />} />
            <Route path="/products/:id" element={<ProductPage />} />
          </Routes>
        </ComparisonSelectionProvider>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('radio', { name: 'Pantry Staples' }));
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/catalog?q=water&category=Pantry+Staples&sort=price_desc&pageSize=24',
    );

    await user.click(
      within(screen.getByRole('heading', { name: 'Powdered Water' })).getByRole('link'),
    );
    expect(await screen.findByRole('heading', { name: 'Powdered Water', level: 1 })).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Back' }));
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/catalog?q=water&category=Pantry+Staples&sort=price_desc&pageSize=24',
      ),
    );
    expect(screen.getByRole('heading', { name: 'Pantry Staples' })).toBeVisible();
  });

  it('keeps two same-category products on different schemes and carries the card scheme into the gallery', async () => {
    const user = userEvent.setup();
    const first = tradeProduct('33', 'Portland Cement');
    const second = tradeProduct('34', 'Plaster of Paris');
    vi.mocked(useProducts).mockReturnValue({
      products: [first, second],
      isLoading: false,
      error: null,
      total: 2,
      currentPage: 1,
      currentPageSize: 24,
      refetch: vi.fn().mockResolvedValue(undefined),
    });
    vi.mocked(getProduct).mockResolvedValue(first);

    render(
      <MemoryRouter initialEntries={['/catalog']}>
        <ComparisonSelectionProvider
          storage={{ getItem: () => null, setItem: () => undefined, removeItem: () => undefined }}
        >
          <NavigationControls />
          <Routes>
            <Route path="/catalog" element={<CatalogPage />} />
            <Route path="/products/:id" element={<ProductPage />} />
          </Routes>
        </ComparisonSelectionProvider>
      </MemoryRouter>,
    );

    const firstCardScheme = screen
      .getByRole('img', { name: `${first.name} stitched kraft sack` })
      .getAttribute('data-colour-scheme');
    const secondCardScheme = screen
      .getByRole('img', { name: `${second.name} stitched kraft sack` })
      .getAttribute('data-colour-scheme');

    expect(firstCardScheme).toMatch(/^[a-z]+(-[a-z]+)+$/);
    expect(secondCardScheme).toMatch(/^[a-z]+(-[a-z]+)+$/);
    expect(firstCardScheme).not.toBe(secondCardScheme);
    // Exact Trade & Creative Materials rows at index `(Number(id) - 1) % 5`: 33 -> 2, 34 -> 3.
    expect(firstCardScheme).toBe('ultramarine-blue');
    expect(secondCardScheme).toBe('mineral-green');

    await user.click(within(screen.getByRole('heading', { name: first.name })).getByRole('link'));
    expect(await screen.findByRole('heading', { name: first.name, level: 1 })).toBeVisible();

    const gallery = screen.getByRole('region', { name: `${first.name} images` });
    expect(
      within(gallery)
        .getByRole('img', { name: `${first.name} stitched kraft sack` })
        .getAttribute('data-colour-scheme'),
    ).toBe(firstCardScheme);
  });
});
