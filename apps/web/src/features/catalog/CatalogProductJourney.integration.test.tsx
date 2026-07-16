import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import type { Product } from '@shop/contracts/products';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getProduct, getRelatedProducts } from '@/api/products';
import { useCategories } from '@/hooks/useCategories';
import { useProducts } from '@/hooks/useProducts';
import { CatalogPage } from './CatalogPage';
import { ProductPage } from '../product/ProductPage';

vi.mock('@/api/products', () => ({
  getProduct: vi.fn(),
  getRelatedProducts: vi.fn(),
}));
vi.mock('@/hooks/useProducts', () => ({ useProducts: vi.fn() }));
vi.mock('@/hooks/useCategories', () => ({ useCategories: vi.fn() }));
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

const catalogProduct: Product = {
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
  tags: [],
  specificationGroups: [],
  mixable: false,
};

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
    vi.mocked(getRelatedProducts).mockResolvedValue([]);
  });

  it('keeps the selected catalog filter after product navigation and browser back', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/catalog?q=water&sort=price_desc&page=2&pageSize=24']}>
        <NavigationControls />
        <Routes>
          <Route path="/catalog" element={<CatalogPage />} />
          <Route path="/products/:id" element={<ProductPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Pantry Staples' }));
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/catalog?q=water&sort=price_desc&pageSize=24&category=Pantry+Staples',
    );

    await user.click(
      within(screen.getByRole('heading', { name: 'Powdered Water' })).getByRole('link'),
    );
    expect(await screen.findByRole('heading', { name: 'Powdered Water', level: 1 })).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Back' }));
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/catalog?q=water&sort=price_desc&pageSize=24&category=Pantry+Staples',
      ),
    );
    expect(screen.getByRole('heading', { name: 'Pantry Staples' })).toBeVisible();
  });
});
