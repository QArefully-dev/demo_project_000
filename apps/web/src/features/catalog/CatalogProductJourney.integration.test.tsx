import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import type { Product } from '@shop/contracts';
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
  name: 'Catalog product',
  description: 'Test product',
  priceCents: 1000,
  imageSetId: 'headphones',
  images: [{ src: '/images/products/test.webp', alt: 'Catalog product', width: 720, height: 720 }],
  category: 'Accessories',
  stock: 5,
  slug: 'catalog-product',
  salesCount: 0,
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
      categories: ['Accessories', 'Audio'],
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
      debouncedFetch: vi.fn(),
    });
    vi.mocked(getProduct).mockResolvedValue(catalogProduct);
    vi.mocked(getRelatedProducts).mockResolvedValue([]);
  });

  it('keeps the selected catalog filter after product navigation and browser back', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/catalog?q=audio&sort=price_desc&page=2&pageSize=24']}>
        <NavigationControls />
        <Routes>
          <Route path="/catalog" element={<CatalogPage />} />
          <Route path="/products/:id" element={<ProductPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Accessories' }));
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/catalog?q=audio&sort=price_desc&pageSize=24&category=Accessories',
    );

    await user.click(
      within(screen.getByRole('heading', { name: 'Catalog product' })).getByRole('link'),
    );
    expect(await screen.findByRole('heading', { name: 'Catalog product', level: 1 })).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Back' }));
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/catalog?q=audio&sort=price_desc&pageSize=24&category=Accessories',
      ),
    );
    expect(screen.getByRole('heading', { name: 'Accessories' })).toBeVisible();
  });
});
