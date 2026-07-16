import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Product, ProductFilterOptionsResponse } from '@shop/contracts/products';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCategories } from '@/hooks/useCategories';
import { useProductFilterOptions } from '@/hooks/useProductFilterOptions';
import { useProducts } from '@/hooks/useProducts';
import { CatalogPage } from './CatalogPage';

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
  createdAt: '2026-07-14T00:00:00.000Z',
  available: true,
  tags: [],
  specificationGroups: [],
  mixable: false,
};

const filterOptions: ProductFilterOptionsResponse = {
  tags: [
    { key: 'drink-mix', label: 'Drink mix' },
    { key: 'pantry', label: 'Pantry' },
  ],
  specificationGroups: [
    {
      key: 'appearance',
      label: 'Appearance',
      order: 1,
      specifications: [
        {
          key: 'texture',
          label: 'Texture',
          values: [
            { key: 'fine', label: 'Fine' },
            { key: 'granular', label: 'Granular' },
          ],
        },
      ],
    },
  ],
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
    vi.mocked(useProductFilterOptions).mockReturnValue({
      options: filterOptions,
      isLoading: false,
      error: null,
      refetch: vi.fn().mockResolvedValue(undefined),
    });
  });

  it('restores every advanced filter from a direct URL and clear-all keeps sorting and page size', async () => {
    const user = userEvent.setup();
    renderCatalog(
      '/catalog?q=water&category=Impossible&onSale=true&minPriceCents=200&maxPriceCents=2500&addedFrom=2026-01-01&addedTo=2026-06-30&tag=pantry&tag=drink-mix&spec=texture%3Afine&availability=available&sort=price_desc&page=2&pageSize=24',
    );

    expect(vi.mocked(useProducts)).toHaveBeenLastCalledWith({
      q: 'water',
      category: 'Impossible',
      onSale: true,
      minPriceCents: 200,
      maxPriceCents: 2500,
      addedFrom: '2026-01-01',
      addedTo: '2026-06-30',
      tag: ['drink-mix', 'pantry'],
      spec: ['texture:fine'],
      availability: 'available',
      sort: 'price_desc',
      page: 2,
      pageSize: 24,
    });
    await user.click(screen.getByRole('button', { name: /clear all/i }));
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/catalog?sort=price_desc&pageSize=24',
    );
  });

  it.each([
    ['category', (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole('radio', { name: 'Pantry Staples' }))],
    ['sale', (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole('checkbox', { name: 'On sale now' }))],
    ['price', (user: ReturnType<typeof userEvent.setup>) => user.type(screen.getByLabelText('Minimum (cents)'), '300')],
    ['date', async () => {
      fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-01-01' } });
    }],
    ['availability', (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole('radio', { name: 'In stock' }))],
    ['tag', (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole('checkbox', { name: 'Drink mix' }))],
    ['specification', (user: ReturnType<typeof userEvent.setup>) => user.selectOptions(screen.getByLabelText('Texture'), 'fine')],
    ['sort', (user: ReturnType<typeof userEvent.setup>) => user.selectOptions(screen.getByLabelText('Sort'), 'oldest')],
    ['page size', (user: ReturnType<typeof userEvent.setup>) => user.selectOptions(screen.getByLabelText('Per page'), '24')],
  ])('removes page when %s changes locally', async (_name, mutate) => {
    const user = userEvent.setup();
    renderCatalog('/catalog?page=2');

    await mutate(user);
    await waitFor(() => expect(screen.getByTestId('location')).not.toHaveTextContent('page=2'));
  });

  it('drops malformed URL values when the next state mutation occurs', async () => {
    const user = userEvent.setup();
    renderCatalog('/catalog?tag=Bad%20tag&spec=texture%3Ainvalid%20value&sort=wrong&page=zero');

    expect(vi.mocked(useProducts)).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, tag: [], spec: [] }),
    );
    await user.click(screen.getByRole('checkbox', { name: 'Drink mix' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/catalog?tag=drink-mix');
  });

  it('keeps catalog results usable when filter options fail', () => {
    vi.mocked(useProductFilterOptions).mockReturnValue({
      options: null,
      isLoading: false,
      error: 'offline',
      refetch: vi.fn().mockResolvedValue(undefined),
    });
    renderCatalog('/catalog?q=water');

    expect(screen.getByText('More filters are unavailable.')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Powdered Water' })).toBeVisible();
    expect(screen.getByRole('searchbox', { name: 'Search powders' })).toHaveValue('water');
  });

  it('preserves selected filters through product-route history back and forward', async () => {
    const user = userEvent.setup();
    renderCatalog('/catalog?q=water&sort=price_desc&page=2&pageSize=24');

    await user.click(screen.getByRole('radio', { name: 'Pantry Staples' }));
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/catalog?q=water&category=Pantry+Staples&sort=price_desc&pageSize=24',
    );
    await user.click(
      within(screen.getByRole('heading', { name: 'Powdered Water' })).getByRole('link'),
    );
    await waitFor(() => expect(screen.getByText('Product route')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Back' }));

    expect(screen.getByTestId('location')).toHaveTextContent(
      '/catalog?q=water&category=Pantry+Staples&sort=price_desc&pageSize=24',
    );
    expect(screen.getByRole('heading', { name: 'Pantry Staples' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Forward' }));
    await waitFor(() => expect(screen.getByText('Product route')).toBeInTheDocument());
    expect(screen.getByTestId('location')).toHaveTextContent('/products/1');

    await user.click(screen.getByRole('button', { name: 'Back' }));
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/catalog?q=water&category=Pantry+Staples&sort=price_desc&pageSize=24',
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
      minPriceCents: undefined,
      maxPriceCents: undefined,
      addedFrom: undefined,
      addedTo: undefined,
      tag: [],
      spec: [],
      availability: undefined,
      sort: undefined,
      page: 1,
      pageSize: 12,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });
});
