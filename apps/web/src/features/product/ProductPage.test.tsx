import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import type { Product } from '@shop/contracts/products';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/api/client';
import {
  ComparisonSelectionProvider,
  useComparisonSelection,
} from '@/features/comparison/ComparisonSelectionContext';
import { ProductPage } from './ProductPage';

const productApi = vi.hoisted(() => ({
  getProduct: vi.fn(),
  getSimilarProducts: vi.fn(),
}));
const cart = vi.hoisted(() => ({
  addItem: vi.fn(),
  retryCart: vi.fn(),
  isActionPending: vi.fn(() => false),
  error: null as string | null,
  isCartAvailable: true,
}));
const secondaryState = vi.hoisted(() => ({
  bundleError: null as string | null,
  reviewError: null as string | null,
}));

vi.mock('@/api/products', () => productApi);
vi.mock('@/hooks/CartContext', () => ({ useCartContext: () => cart }));
vi.mock('@/components/WishlistButton', () => ({
  WishlistButton: () => <button type="button">Wishlist</button>,
}));
vi.mock('./ProductBundlesSection', () => ({
  ProductBundlesSection: ({ productId }: { productId: string }) => (
    <section aria-labelledby="product-bundles-heading" data-testid="bundles-section">
      <h2 id="product-bundles-heading">Complete your selection</h2>
      <p>{productId}</p>
      {secondaryState.bundleError && <p role="alert">{secondaryState.bundleError}</p>}
    </section>
  ),
}));
vi.mock('./ReviewsSection', () => ({
  ReviewsSection: ({ productId }: { productId: string }) => (
    <section aria-labelledby="reviews-heading" data-testid="reviews-section">
      <h2 id="reviews-heading">Customer reviews</h2>
      <p>{productId}</p>
      {secondaryState.reviewError && <p role="alert">{secondaryState.reviewError}</p>}
    </section>
  ),
}));

const comparisonStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

const product = (overrides: Partial<Product> = {}): Product => ({
  id: 'powdered-water',
  name: 'Powdered Water',
  description: 'Just-add-water water powder, 300g. Dry until required.',
  priceCents: 12999,
  compareAtPriceCents: 16999,
  imageSetId: 'powdered-water',
  category: 'Impossible',
  stock: 8,
  slug: 'powdered-water',
  salesCount: 12,
  ...overrides,
  createdAt: overrides.createdAt ?? '2026-07-14T00:00:00.000Z',
  available: overrides.available ?? true,
  tags: overrides.tags ?? [],
  specificationGroups: overrides.specificationGroups ?? [],
  mixable: overrides.mixable ?? false,
});

function renderPage(path = '/products/powdered-water') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ComparisonSelectionProvider storage={comparisonStorage}>
        <Routes>
          <Route path="/products/:id" element={<ProductPage />} />
        </Routes>
      </ComparisonSelectionProvider>
    </MemoryRouter>,
  );
}

function deferred<T>() {
  let resolve: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve: resolve! };
}

function RouteControls() {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate('/products/second')}>
      Load second product
    </button>
  );
}

function ComparisonDestination() {
  const { selectedIds } = useComparisonSelection();
  return <output data-testid="selected-ids">{selectedIds.join(',')}</output>;
}

function CatalogNavigation() {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate('/catalog')}>
      Leave product
    </button>
  );
}

describe('ProductPage', () => {
  afterEach(() => {
    vi.clearAllMocks();
    cart.addItem.mockReset();
    cart.retryCart.mockReset();
    cart.isActionPending.mockReset();
    cart.isActionPending.mockReturnValue(false);
    cart.error = null;
    cart.isCartAvailable = true;
    secondaryState.bundleError = null;
    secondaryState.reviewError = null;
  });

  it('renders core product content while the similar request remains pending', async () => {
    const response = deferred<Product>();
    const similarResponse = deferred<Product[]>();
    productApi.getProduct.mockReturnValueOnce(response.promise);
    productApi.getSimilarProducts.mockReturnValueOnce(similarResponse.promise);

    renderPage();
    expect(screen.queryByRole('heading', { name: 'Powdered Water' })).not.toBeInTheDocument();

    response.resolve(product());
    expect(await screen.findByRole('heading', { name: 'Powdered Water' })).toBeInTheDocument();
    expect(screen.getByText('Finding similar powders...')).toBeInTheDocument();
  });

  it('renders API and not-found failures distinctly', async () => {
    productApi.getProduct.mockRejectedValueOnce(new Error('Product service unavailable'));
    const { unmount } = renderPage();
    expect(await screen.findByText('Product service unavailable')).toBeInTheDocument();
    unmount();

    productApi.getProduct.mockRejectedValueOnce(new ApiError('Missing', 404));
    renderPage();
    expect(await screen.findByText('Product not found')).toBeInTheDocument();
  });

  it('renders sale, regular, and stock purchase states from the product response', async () => {
    productApi.getProduct.mockResolvedValueOnce(product());
    productApi.getSimilarProducts.mockResolvedValueOnce([]);
    const { unmount } = renderPage();
    expect(await screen.findByText('Sale')).toBeInTheDocument();
    expect(screen.getByText('Save $40.00')).toBeInTheDocument();
    unmount();

    productApi.getProduct.mockResolvedValueOnce(
      product({ compareAtPriceCents: undefined, stock: 0 }),
    );
    productApi.getSimilarProducts.mockResolvedValueOnce([]);
    renderPage();
    expect(await screen.findByText('Out of stock')).toBeInTheDocument();
    expect(screen.queryByText('Sale')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Unavailable' })).toBeDisabled();
  });

  it('prevents concurrent cart mutations, then permits a retry after failure', async () => {
    const user = userEvent.setup();
    const pendingAdd = deferred<boolean>();
    cart.addItem.mockReset();
    cart.addItem.mockReturnValueOnce(pendingAdd.promise).mockResolvedValueOnce(true);
    cart.isActionPending.mockReturnValue(false);
    cart.error = null;
    cart.isCartAvailable = true;
    productApi.getProduct.mockResolvedValueOnce(product());
    productApi.getSimilarProducts.mockResolvedValueOnce([]);

    renderPage();
    const addButton = await screen.findByRole('button', { name: 'Add powder' });
    await user.click(addButton);
    await user.click(addButton);
    expect(cart.addItem).toHaveBeenCalledOnce();

    pendingAdd.resolve(false);
    expect(await screen.findByText('Could not add this item. Try again.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add powder' }));
    await waitFor(() => expect(cart.addItem).toHaveBeenCalledTimes(2));
    expect(screen.queryByText('Could not add this item. Try again.')).not.toBeInTheDocument();
  });

  it('keeps the purchase panel usable when similar products fail', async () => {
    const user = userEvent.setup();
    cart.addItem.mockResolvedValue(true);
    productApi.getProduct.mockResolvedValueOnce(product());
    productApi.getSimilarProducts.mockRejectedValueOnce(new Error('Similarity unavailable'));

    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load similar powders.');
    await user.click(screen.getByRole('button', { name: 'Add powder' }));
    expect(cart.addItem).toHaveBeenCalledWith('powdered-water');
  });

  it('aborts and ignores a stale similar response after the route product changes', async () => {
    const user = userEvent.setup();
    const firstSimilar = deferred<Product[]>();
    const secondSimilar = deferred<Product[]>();
    productApi.getProduct
      .mockResolvedValueOnce(product({ id: 'first', name: 'First powder' }))
      .mockResolvedValueOnce(product({ id: 'second', name: 'Second powder' }));
    productApi.getSimilarProducts
      .mockReturnValueOnce(firstSimilar.promise)
      .mockReturnValueOnce(secondSimilar.promise);

    render(
      <MemoryRouter initialEntries={['/products/first']}>
        <ComparisonSelectionProvider storage={comparisonStorage}>
          <RouteControls />
          <Routes>
            <Route path="/products/:id" element={<ProductPage />} />
          </Routes>
        </ComparisonSelectionProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'First powder' })).toBeInTheDocument();
    const firstSignal = productApi.getSimilarProducts.mock.calls[0]?.[1] as AbortSignal;
    await user.click(screen.getByRole('button', { name: 'Load second product' }));
    expect(await screen.findByRole('heading', { name: 'Second powder' })).toBeInTheDocument();
    expect(firstSignal.aborted).toBe(true);

    firstSimilar.resolve([product({ id: 'stale', name: 'Stale powder' })]);
    secondSimilar.resolve([product({ id: 'fresh', name: 'Fresh powder' })]);
    expect(await screen.findByRole('heading', { name: 'Fresh powder', level: 3 })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Stale powder', level: 3 })).not.toBeInTheDocument();
  });

  it('renders an explicit empty similar state and keeps ranked API order in cards', async () => {
    productApi.getProduct.mockResolvedValueOnce(product());
    productApi.getSimilarProducts.mockResolvedValueOnce([]);
    const { unmount } = renderPage();
    await screen.findByRole('heading', { name: 'Powdered Water' });
    expect(await screen.findByText('No similar powders available right now.')).toBeInTheDocument();
    unmount();

    productApi.getProduct.mockResolvedValueOnce(product());
    productApi.getSimilarProducts.mockResolvedValueOnce([
      product({ id: 'ranked-second', name: 'Ranked second' }),
      product({ id: 'ranked-first', name: 'Ranked first' }),
    ]);
    const { container } = renderPage();
    await screen.findByRole('heading', { name: 'Ranked second', level: 3 });
    const cards = [...container.querySelectorAll('h3')].filter((card) =>
      ['Ranked second', 'Ranked first'].includes(card.textContent ?? ''),
    );
    expect(cards.map((card) => card.textContent)).toEqual(['Ranked second', 'Ranked first']);
  });

  it('keeps core actions usable when bundle and review failures are section-local', async () => {
    const user = userEvent.setup();
    cart.addItem.mockResolvedValue(true);
    cart.error = 'Shared bundle cart error';
    secondaryState.bundleError = 'Could not add this bundle. Try again.';
    secondaryState.reviewError = 'Could not load reviews.';
    productApi.getProduct.mockResolvedValueOnce(product());
    productApi.getSimilarProducts.mockResolvedValueOnce([]);

    renderPage();
    expect(await screen.findByText('Could not add this bundle. Try again.')).toBeInTheDocument();
    expect(screen.getByText('Could not load reviews.')).toBeInTheDocument();
    expect(screen.queryByText('Shared bundle cart error')).not.toBeInTheDocument();

    const addButton = screen.getByRole('button', { name: 'Add powder' });
    expect(addButton).toBeEnabled();
    await user.click(addButton);
    expect(cart.addItem).toHaveBeenCalledWith('powdered-water');
  });

  it('composes product sections in journey order with current specification data', async () => {
    productApi.getProduct.mockResolvedValueOnce(
      product({
        packaging: {
          labelColor: '#287fa6',
          powderColor: '#b9e2ee',
          mark: 'H2O',
          batchCode: 'IMP-07',
          quantity: '300g',
        },
        specificationGroups: [
          {
            key: 'format',
            label: 'Format',
            order: 1,
            specifications: [
              { key: 'weight', label: 'Weight', valueKey: '300g', value: '300g' },
            ],
          },
        ],
      }),
    );
    productApi.getSimilarProducts.mockResolvedValueOnce([]);

    const { container } = renderPage();
    await screen.findByRole('heading', { name: 'Powdered Water' });

    expect(screen.getByRole('heading', { name: 'Specifications' })).toBeInTheDocument();
    expect(screen.getByText('Weight')).toBeInTheDocument();
    const sections = [...container.querySelectorAll('section')];
    const position = (label: string) =>
      sections.findIndex((section) => section.getAttribute('aria-labelledby') === label);
    expect(position('product-details-heading')).toBeLessThan(position('product-specifications-heading'));
    expect(position('product-specifications-heading')).toBeLessThan(
      position('product-context-links-heading'),
    );
    expect(position('product-context-links-heading')).toBeLessThan(
      position('product-bundles-heading'),
    );
    expect(position('product-bundles-heading')).toBeLessThan(position('reviews-heading'));
    expect(position('reviews-heading')).toBeLessThan(position('similar-products-heading'));
  });

  it('does not mount secondary sections or request similar products for a missing product', async () => {
    productApi.getProduct.mockRejectedValueOnce(new ApiError('Missing', 404));

    renderPage();
    expect(await screen.findByText('Product not found')).toBeInTheDocument();
    expect(screen.queryByTestId('bundles-section')).not.toBeInTheDocument();
    expect(screen.queryByTestId('reviews-section')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Similar powders')).not.toBeInTheDocument();
    expect(productApi.getSimilarProducts).not.toHaveBeenCalled();
  });

  it('retains product comparison selection after navigating away from product detail', async () => {
    const user = userEvent.setup();
    productApi.getProduct.mockResolvedValueOnce(product({ id: '1' }));
    productApi.getSimilarProducts.mockResolvedValueOnce([]);

    render(
      <MemoryRouter initialEntries={['/products/1']}>
        <ComparisonSelectionProvider storage={comparisonStorage}>
          <CatalogNavigation />
          <Routes>
            <Route path="/products/:id" element={<ProductPage />} />
            <Route path="/catalog" element={<ComparisonDestination />} />
          </Routes>
        </ComparisonSelectionProvider>
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole('button', { name: 'Compare Powdered Water' }));
    // Route navigation is performed through React Router so provider state remains mounted.
    await user.click(screen.getByRole('button', { name: 'Leave product' }));
    expect(screen.getByTestId('selected-ids')).toHaveTextContent('1');
  });
});
