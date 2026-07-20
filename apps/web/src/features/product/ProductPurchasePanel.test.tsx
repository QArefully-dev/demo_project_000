import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { ProductWithVariants, CatalogVariant, CategoryFacts } from '@shop/contracts/products';
import type { PublicUser } from '@shop/contracts/auth';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ProductPurchasePanel } from './ProductPurchasePanel';
import {
  ComparisonSelectionProvider,
  useComparisonSelection,
} from '@/features/comparison/ComparisonSelectionContext';

const authState = vi.hoisted(() => ({ user: null as PublicUser | null }));
const favouriteState = vi.hoisted(() => ({
  favouriteIds: new Set<string>(),
  toggleFavourite: vi.fn(),
}));
const comparisonStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

vi.mock('@/hooks/AuthContext', () => ({
  useAuth: () => ({ user: authState.user }),
}));

vi.mock('@/hooks/useFavourites', () => ({
  useFavourites: () => ({
    ...favouriteState,
    favourites: [],
    loading: false,
    removeProduct: vi.fn(),
  }),
}));

const defaultVariant: CatalogVariant = {
  variantId: 1,
  productId: 1,
  sku: 'PW-001',
  label: '300g Bag',
  weightGrams: 300,
  priceCents: 12999,
  compareAtPriceCents: 16999,
  stockCount: 8,
  backorderable: false,
  backorderLeadDays: null,
  deliveryClass: 'parcel',
  active: true,
  sortOrder: 1,
};

const defaultFacts: CategoryFacts = {
  texture: 'Fine',
  colour: 'White',
  source: 'Test',
  intendedUse: 'Testing',
  storage: 'Dry',
  consumptionClassification: 'non-food',
};

const product = (overrides: Partial<ProductWithVariants> = {}): ProductWithVariants => ({
  id: 'powdered-water',
  name: 'Powdered Water',
  description: 'Just-add-water water powder, 300g. Dry until required.',
  priceCents: 12999,
  compareAtPriceCents: 16999,
  imageSetId: 'powdered-water',
  packaging: {
    labelColor: '#287fa6',
    powderColor: '#b9e2ee',
    mark: 'H2O',
    batchCode: 'IMP-07',
    quantity: '300g',
    consumptionLabel: 'Not for consumption',
  },
  category: 'Impossible',
  stock: 8,
  availability: 'in_stock',
  backorderable: false,
  backorderLeadDays: null,
  slug: 'powdered-water',
  salesCount: 12,
  ...overrides,
  createdAt: overrides.createdAt ?? '2026-07-14T00:00:00.000Z',
  available: overrides.available ?? true,
  tags: overrides.tags ?? [],
  specificationGroups: overrides.specificationGroups ?? [],
  mixable: overrides.mixable ?? false,
  variants: overrides.variants ?? [{ ...defaultVariant }],
  defaultVariantId: overrides.defaultVariantId ?? 1,
  categoryFacts: overrides.categoryFacts ?? defaultFacts,
  consumptionClassification: overrides.consumptionClassification ?? 'non-food',
  mixingGroup: overrides.mixingGroup ?? null,
  priceRange: overrides.priceRange ?? { min: 12999, max: 12999 },
  baseAvailability: overrides.baseAvailability ?? 'in_stock',
});

function renderPanel(overrides: Partial<ComponentProps<typeof ProductPurchasePanel>> = {}) {
  const onAddToCart = vi.fn(async () => {});
  const onRetryCart = vi.fn();
  const result = render(
    <MemoryRouter initialEntries={['/products/powdered-water']}>
      <ComparisonSelectionProvider storage={comparisonStorage}>
        <Routes>
          <Route
            path="*"
            element={
              <ProductPurchasePanel
                product={product()}
                isCartAvailable
                isAdding={false}
                actionError={null}
                cartError={null}
                onAddToCart={onAddToCart}
                onRetryCart={onRetryCart}
                {...overrides}
              />
            }
          />
        </Routes>
      </ComparisonSelectionProvider>
    </MemoryRouter>,
  );
  return { ...result, onAddToCart, onRetryCart };
}

function Location() {
  const location = useLocation();
  return <output>{location.pathname}</output>;
}

function ComparisonPath() {
  const { comparePath } = useComparisonSelection();
  return <output data-testid="compare-path">{comparePath ?? ''}</output>;
}

function ComparisonCompleter() {
  const { toggle } = useComparisonSelection();
  return (
    <button type="button" onClick={() => toggle('2')}>
      Add catalog comparison item
    </button>
  );
}

describe('ProductPurchasePanel', () => {
  it('renders sale savings and requires variant selection before add', async () => {
    const user = userEvent.setup();
    const onAddToCart = vi.fn(async () => {});
    render(
      <MemoryRouter>
        <ComparisonSelectionProvider storage={comparisonStorage}>
          <ProductPurchasePanel
            product={product()}
            isCartAvailable
            isAdding={false}
            actionError={null}
            cartError={null}
            onAddToCart={onAddToCart}
            onRetryCart={() => {}}
          />
        </ComparisonSelectionProvider>
      </MemoryRouter>,
    );

    expect(screen.getAllByText('Sale').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Save $40.00')).toBeInTheDocument();
    expect(screen.getAllByText('Not for consumption').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('300g')).toBeInTheDocument();

    const addButton = screen.getByRole('button', { name: 'Choose a bag option' });
    expect(addButton).toBeDisabled();
    await user.click(addButton);
    expect(onAddToCart).not.toHaveBeenCalled();

    const variantRadio = screen.getByRole('radio');
    await user.click(variantRadio);
    expect(screen.getByRole('button', { name: 'Add powder' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Add powder' }));
    expect(onAddToCart).toHaveBeenCalledWith(1);
  });

  it('renders regular price without sale metadata', () => {
    render(
      <MemoryRouter>
        <ComparisonSelectionProvider storage={comparisonStorage}>
          <ProductPurchasePanel
            product={product({
              compareAtPriceCents: undefined,
              priceRange: { min: 12999, max: 12999 },
              variants: [{ ...defaultVariant, compareAtPriceCents: undefined }],
            })}
            isCartAvailable
            isAdding={false}
            actionError={null}
            cartError={null}
            onAddToCart={async () => {}}
            onRetryCart={() => {}}
          />
        </ComparisonSelectionProvider>
      </MemoryRouter>,
    );
    expect(screen.queryByText('Sale')).not.toBeInTheDocument();
    expect(screen.queryByText(/Save \$/)).not.toBeInTheDocument();
  });

  it('disables unavailable purchases and exposes pending and cart retry states', async () => {
    const user = userEvent.setup();
    const onAddToCart = vi.fn(async () => {});
    const onRetryCart = vi.fn();
    render(
      <MemoryRouter>
        <ComparisonSelectionProvider storage={comparisonStorage}>
          <ProductPurchasePanel
            product={product({
              stock: 0,
              availability: 'out_of_stock',
              baseAvailability: 'out_of_stock',
              variants: [{ ...defaultVariant, stockCount: 0, active: false }],
            })}
            isCartAvailable
            isAdding={false}
            actionError={null}
            cartError="Unable to reach cart"
            onAddToCart={onAddToCart}
            onRetryCart={onRetryCart}
          />
        </ComparisonSelectionProvider>
      </MemoryRouter>,
    );

    const addButton = screen.getByRole('button', { name: 'Unavailable' });
    expect(addButton).toBeDisabled();
    await user.click(addButton);
    expect(onAddToCart).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Retry cart' }));
    expect(onRetryCart).toHaveBeenCalledOnce();

    render(
      <MemoryRouter>
        <ComparisonSelectionProvider storage={comparisonStorage}>
          <ProductPurchasePanel
            product={product()}
            isCartAvailable
            isAdding
            actionError={null}
            cartError={null}
            onAddToCart={async () => {}}
            onRetryCart={() => {}}
          />
        </ComparisonSelectionProvider>
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: 'Adding…' })).toBeDisabled();
  });

  it('keeps a backorderable product purchasable without promising an arrival date', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ComparisonSelectionProvider storage={comparisonStorage}>
          <ProductPurchasePanel
            product={product({
              stock: 0,
              availability: 'backorder',
              backorderable: true,
              backorderLeadDays: 14,
              baseAvailability: 'backorder',
              variants: [
                {
                  ...defaultVariant,
                  stockCount: 0,
                  backorderable: true,
                  backorderLeadDays: 14,
                },
              ],
            })}
            isCartAvailable
            isAdding={false}
            actionError={null}
            cartError={null}
            onAddToCart={async () => {}}
            onRetryCart={() => {}}
          />
        </ComparisonSelectionProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText('Available to backorder')).toBeInTheDocument();
    await user.click(screen.getByRole('radio'));
    expect(screen.getByRole('button', { name: 'Add powder' })).toBeEnabled();
  });

  it('sends anonymous wishlist actions to sign-in and toggles authenticated favourites', async () => {
    const user = userEvent.setup();
    authState.user = null;
    favouriteState.favouriteIds = new Set();
    favouriteState.toggleFavourite.mockReset();
    render(
      <MemoryRouter initialEntries={['/products/powdered-water']}>
        <ComparisonSelectionProvider storage={comparisonStorage}>
          <Routes>
            <Route
              path="*"
              element={
                <>
                  <ProductPurchasePanel
                    product={product()}
                    isCartAvailable
                    isAdding={false}
                    actionError={null}
                    cartError={null}
                    onAddToCart={async () => {}}
                    onRetryCart={() => {}}
                  />
                  <Location />
                </>
              }
            />
            <Route path="/login" element={<Location />} />
          </Routes>
        </ComparisonSelectionProvider>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Add to wishlist' }));
    expect(screen.getByText('/login')).toBeInTheDocument();
    expect(favouriteState.toggleFavourite).not.toHaveBeenCalled();

    authState.user = {
      id: 'user-1',
      email: 'shopper@example.test',
      displayName: 'Shopper',
      role: 'customer',
    };
    favouriteState.favouriteIds = new Set();
    favouriteState.toggleFavourite.mockReset();
    const authenticated = renderPanel();
    await user.click(screen.getByRole('button', { name: 'Add to wishlist' }));
    expect(favouriteState.toggleFavourite).toHaveBeenCalledWith(
      'powdered-water',
      expect.objectContaining({ id: 'powdered-water' }),
    );
    authenticated.unmount();
  });

  it('adds a secondary comparison action without changing cart availability', async () => {
    const user = userEvent.setup();
    const onAddToCart = vi.fn(async () => {});
    render(
      <MemoryRouter>
        <ComparisonSelectionProvider storage={comparisonStorage}>
          <ProductPurchasePanel
            product={product({ id: '1' })}
            isCartAvailable
            isAdding={false}
            actionError={null}
            cartError={null}
            onAddToCart={onAddToCart}
            onRetryCart={() => {}}
          />
          <ComparisonPath />
          <ComparisonCompleter />
        </ComparisonSelectionProvider>
      </MemoryRouter>,
    );

    const compare = screen.getByRole('button', { name: 'Compare Powdered Water' });
    expect(compare).toHaveAttribute('aria-pressed', 'false');
    // Button should be disabled until variant selected
    expect(screen.getByRole('button', { name: 'Choose a bag option' })).toBeDisabled();

    await user.click(compare);
    expect(compare).toHaveAttribute('aria-pressed', 'true');
    expect(onAddToCart).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Add catalog comparison item' }));
    expect(screen.getByTestId('compare-path')).toHaveTextContent('/compare?ids=1,2');
  });

  it('shows variant details when selected including price, SKU, and stock', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ComparisonSelectionProvider storage={comparisonStorage}>
          <ProductPurchasePanel
            product={product()}
            isCartAvailable
            isAdding={false}
            actionError={null}
            cartError={null}
            onAddToCart={async () => {}}
            onRetryCart={() => {}}
          />
        </ComparisonSelectionProvider>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('radio'));
    expect(screen.getAllByText(/SKU: PW-001/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('8 in stock')).toBeInTheDocument();
    expect(screen.getAllByText('$129.99').length).toBeGreaterThanOrEqual(1);
  });
});
