import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Product } from '@shop/contracts/products';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  name: 'Powdered Water',
  description: 'Just-add-water water powder, 300g. Dry until required.',
  priceCents: 1000,
  imageSetId: 'powdered-water',
  category: 'Impossible',
  stock: 5,
  slug: 'powdered-water',
  salesCount: 0,
  mixable: false,
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
      <button type="button" onClick={() => navigate(1)}>
        Forward
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
      categories: ['Impossible', 'Pantry Staples'],
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
    });
  });

  it('parses a shareable query and clear-all keeps sorting and page size', async () => {
    const user = userEvent.setup();
    renderCatalog(
      '/catalog?q=water&category=Impossible&onSale=true&sort=price_desc&page=2&pageSize=24',
    );

    expect(vi.mocked(useProducts)).toHaveBeenLastCalledWith({
      q: 'water',
      category: 'Impossible',
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

  it('preserves selected filters through product-route history back and forward', async () => {
    const user = userEvent.setup();
    renderCatalog('/catalog?q=water&sort=price_desc&page=2&pageSize=24');

    await user.click(screen.getByRole('button', { name: 'Pantry Staples' }));
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/catalog?q=water&sort=price_desc&pageSize=24&category=Pantry+Staples',
    );
    await user.click(
      within(screen.getByRole('heading', { name: 'Powdered Water' })).getByRole('link'),
    );
    await waitFor(() => expect(screen.getByText('Product route')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Back' }));

    expect(screen.getByTestId('location')).toHaveTextContent(
      '/catalog?q=water&sort=price_desc&pageSize=24&category=Pantry+Staples',
    );
    expect(screen.getByRole('heading', { name: 'Pantry Staples' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Forward' }));
    await waitFor(() => expect(screen.getByText('Product route')).toBeInTheDocument());
    expect(screen.getByTestId('location')).toHaveTextContent('/products/1');

    await user.click(screen.getByRole('button', { name: 'Back' }));
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/catalog?q=water&sort=price_desc&pageSize=24&category=Pantry+Staples',
      ),
    );
  });

  it('debounces URL search updates before requesting products', async () => {
    vi.useFakeTimers();
    renderCatalog('/catalog');

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search powders' }), {
      target: { value: 'water' },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(299);
    });
    expect(vi.mocked(useProducts)).not.toHaveBeenLastCalledWith(
      expect.objectContaining({ q: 'water' }),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(screen.getByTestId('location')).toHaveTextContent('/catalog?q=water');
    expect(vi.mocked(useProducts)).toHaveBeenLastCalledWith({
      q: 'water',
      category: undefined,
      onSale: undefined,
      sort: undefined,
      page: 1,
      pageSize: 12,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });
});
