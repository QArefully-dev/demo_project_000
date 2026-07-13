import { render, screen, waitFor, within } from '@testing-library/react';
import type { Product } from '@shop/contracts';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCategories } from '@/hooks/useCategories';
import { useProducts } from '@/hooks/useProducts';
import { CatalogPage } from './CatalogPage';

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
  WishlistButton: () => <button type="button" aria-label="Add to wishlist" />,
}));

const catalogProduct: Product = {
  id: '1',
  name: 'Catalog product',
  description: 'Test product',
  priceCents: 1000,
  imageSetId: 'headphones',
  images: [{ src: '/images/products/test.webp', alt: 'Catalog product', width: 720, height: 720 }],
  category: 'Audio',
  stock: 5,
  slug: 'catalog-product',
  salesCount: 0,
};

function LocationControls() {
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

function renderCatalog(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <LocationControls />
      <Routes>
        <Route path="/catalog" element={<CatalogPage />} />
        <Route path="/products/:id" element={<p>Product route</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('CatalogPage URL state', () => {
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
      total: 48,
      currentPage: 1,
      currentPageSize: 12,
      refetch: vi.fn().mockResolvedValue(undefined),
      debouncedFetch: vi.fn(),
    });
  });

  it('parses a shareable query and clear-all keeps sorting and page size', async () => {
    const user = userEvent.setup();
    renderCatalog('/catalog?q=audio&category=Audio&onSale=true&sort=price_desc&page=2&pageSize=24');

    expect(vi.mocked(useProducts)).toHaveBeenLastCalledWith({
      q: 'audio',
      category: 'Audio',
      onSale: true,
      sort: 'price_desc',
      page: 2,
      pageSize: 24,
    });
    await user.click(screen.getByRole('button', { name: /clear all/i }));
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/catalog?sort=price_desc&pageSize=24',
    );
  });

  it('preserves selected filters after a product route and history back', async () => {
    const user = userEvent.setup();
    renderCatalog('/catalog?q=audio&sort=price_desc&page=2&pageSize=24');

    await user.click(screen.getByRole('button', { name: 'Accessories' }));
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/catalog?q=audio&sort=price_desc&pageSize=24&category=Accessories',
    );
    await user.click(
      within(screen.getByRole('heading', { name: 'Catalog product' })).getByRole('link'),
    );
    await waitFor(() => expect(screen.getByText('Product route')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Back' }));

    expect(screen.getByTestId('location')).toHaveTextContent(
      '/catalog?q=audio&sort=price_desc&pageSize=24&category=Accessories',
    );
    expect(screen.getByRole('heading', { name: 'Accessories' })).toBeInTheDocument();
  });
});
