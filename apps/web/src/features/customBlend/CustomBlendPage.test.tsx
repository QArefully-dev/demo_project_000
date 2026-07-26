import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useSearchParams } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Cart, CartLine } from '@shop/contracts/cart';
import type { CustomBlendOption, CustomBlendOptionsResponse } from '@shop/contracts/custom-blends';
import { getCustomBlendOptions } from '@/api/customBlends';
import { getProduct } from '@/api/products';
import { useCartContext } from '@/hooks/CartContext';
import { useProducts } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { CustomBlendPage } from './CustomBlendPage';
import { CUSTOM_BLEND_MADE_TO_ORDER_NOTE } from './CustomBlendPackaging';

vi.mock('@/api/customBlends', () => ({
  getCustomBlendOptions: vi.fn(),
  createCustomBlend: vi.fn(),
  replaceCustomBlend: vi.fn(),
}));
vi.mock('@/hooks/CartContext', () => ({ useCartContext: vi.fn() }));
vi.mock('@/api/products', () => ({ getProduct: vi.fn() }));
vi.mock('@/hooks/useProducts', () => ({ useProducts: vi.fn() }));
vi.mock('@/hooks/useCategories', () => ({ useCategories: vi.fn() }));

const EDIT_CONFIG_KEY = 'a'.repeat(64);

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function option(
  variantId: number,
  productName: string,
  overrides: { stockCount?: number } = {},
): CustomBlendOption {
  return {
    productId: String(variantId),
    productName,
    productDescription: `${productName} description`,
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

function optionsFor(baseName: string, ingredientOptions: CustomBlendOption[]) {
  return {
    base: option(501, baseName),
    ingredients: ingredientOptions,
  } satisfies CustomBlendOptionsResponse;
}

function configuredLine(): CartLine {
  return {
    productId: '9',
    configKey: EDIT_CONFIG_KEY,
    product: {
      id: '9',
      name: 'Portland Cement',
      description: 'Base',
      priceCents: 1_200,
      imageSetId: 'cement',
      category: 'Cement',
      stock: 40,
      availability: 'in_stock',
      backorderable: false,
      backorderLeadDays: null,
      slug: 'portland-cement',
      salesCount: 0,
      createdAt: '2026-07-14T00:00:00.000Z',
      available: true,
      tags: [],
      specificationGroups: [],
    },
    variantSnap: {
      variantId: 501,
      sku: 'MAT-501',
      label: '25 kg sack',
      weightGrams: 25_000,
      deliveryClass: 'freight',
    },
    perTonneCents: 48_000,
    resolvedUnitPriceCents: 1_200,
    quantity: 7,
    materialSubtotalCents: 8_400,
    blendingFeeCents: 2_500,
    discountableTotalCents: 8_400,
    lineTotalCents: 10_900,
    customBlend: {
      configKey: EDIT_CONFIG_KEY,
      basePercentage: 70,
      mixingGroup: 'mineral',
      ingredients: [
        {
          variantId: 601,
          productId: '11',
          productName: 'Chalk Filler',
          productDescription: 'Filler',
          mixingGroup: 'mineral',
          percentage: 30,
        },
      ],
      blendingFeeCents: 2_500,
      madeToOrder: true,
      returnable: false,
    },
  };
}

const addCustomBlend = vi.fn();
const replaceCustomBlend = vi.fn();

function mockCart(cart: Cart | null) {
  vi.mocked(useCartContext).mockReturnValue({
    cart,
    error: null,
    isCartAvailable: true,
    addCustomBlend,
    replaceCustomBlend,
    retryCart: vi.fn(),
  } as unknown as ReturnType<typeof useCartContext>);
}

/** A catalog row the base picker can offer: the sack variant is the only eligible base. */
function pickerProduct(variantId: number, name: string) {
  return {
    ...configuredLine().product,
    id: String(variantId),
    name,
    variants: [{ variantId, weightGrams: 25_000, active: true }],
  };
}

/**
 * The product-detail read, which is the only response that carries variants. Mirrors the real
 * split: catalog list rows have no `variants`, the detail does.
 */
function detailProduct(
  listRow: { id: string; name: string },
  [firstVariant, ...restVariants]: [
    CustomBlendOption['variant'],
    ...CustomBlendOption['variant'][],
  ],
) {
  const variants = [firstVariant, ...restVariants];
  return {
    ...configuredLine().product,
    ...listRow,
    variants,
    defaultVariantId: firstVariant.variantId,
    consumptionClassification: 'non-food' as const,
    mixingGroup: 'mineral' as const,
    priceRange: { min: 1_200, max: 1_200 },
    baseAvailability: 'in_stock' as const,
    categoryFacts: {
      texture: 'Fine',
      colour: 'Grey',
      source: 'Test source',
      intendedUse: 'Testing',
      storage: 'Dry cool',
      consumptionClassification: 'non-food' as const,
    },
  };
}

function mockProducts(products: ReturnType<typeof pickerProduct>[]) {
  vi.mocked(useProducts).mockReturnValue({
    products,
    isLoading: false,
    error: null,
    total: products.length,
    currentPage: 1,
    currentPageSize: 12,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useProducts>);
  // The catalog list response carries no variants, so the picker resolves the eligible sack from
  // the product detail read. The stub mirrors that: same rows, variants only on the detail.
  vi.mocked(getProduct).mockImplementation((id) => {
    const match = products.find((product) => product.id === id);
    return match
      ? Promise.resolve(match as unknown as Awaited<ReturnType<typeof getProduct>>)
      : Promise.reject(new Error(`No product ${id}`));
  });
}

function renderPage(search: string, extra?: React.ReactNode) {
  return render(
    <MemoryRouter initialEntries={[`/custom-blend${search}`]}>
      {extra}
      <CustomBlendPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  addCustomBlend.mockResolvedValue(true);
  replaceCustomBlend.mockResolvedValue(true);
  mockCart({
    id: 'cart',
    items: [],
    subtotalCents: 0,
    discountableSubtotalCents: 0,
    blendingFeeTotalCents: 0,
    totalItems: 0,
  });
  vi.mocked(useCategories).mockReturnValue({ categories: [], isLoading: false, error: null });
  mockProducts([]);
});

describe('CustomBlendPage', () => {
  it('labels every control and reports the derived base remainder as ingredients change', async () => {
    const user = userEvent.setup();
    vi.mocked(getCustomBlendOptions).mockResolvedValue(
      optionsFor('Portland Cement', [option(601, 'Chalk Filler'), option(602, 'Fine Sand')]),
    );
    renderPage('?baseVariantId=501');

    const chalk = await screen.findByLabelText('Chalk Filler');
    expect(screen.getByRole('status')).toHaveTextContent(
      'Base 100% · ingredients 0% · 0 of 4 ingredients selected',
    );

    // Operable from the keyboard alone: focus the checkbox and toggle with Space.
    chalk.focus();
    await user.keyboard(' ');
    expect(screen.getByRole('status')).toHaveTextContent(
      'Base 50% · ingredients 50% · 1 of 4 ingredients selected',
    );

    const percentage = screen.getByLabelText('Chalk Filler percentage');
    fireEvent.change(percentage, { target: { value: '30' } });
    expect(screen.getByRole('status')).toHaveTextContent(
      'Base 70% · ingredients 30% · 1 of 4 ingredients selected',
    );

    await user.click(screen.getByLabelText('Fine Sand'));
    fireEvent.change(screen.getByLabelText('Fine Sand percentage'), { target: { value: '25' } });
    expect(screen.getByRole('status')).toHaveTextContent(
      'Base 45% · ingredients 55% · 2 of 4 ingredients selected',
    );
    expect(
      screen.getByText('Ingredients must total 50% or less. They currently total 55%.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add blend to cart' })).toBeDisabled();
  });

  it('submits a valid blend to the cart', async () => {
    const user = userEvent.setup();
    vi.mocked(getCustomBlendOptions).mockResolvedValue(
      optionsFor('Portland Cement', [option(601, 'Chalk Filler')]),
    );
    renderPage('?baseVariantId=501');

    await user.click(await screen.findByLabelText('Chalk Filler'));
    fireEvent.change(screen.getByLabelText('Chalk Filler percentage'), { target: { value: '20' } });
    await user.click(screen.getByRole('button', { name: 'Add blend to cart' }));

    expect(addCustomBlend).toHaveBeenCalledWith({
      baseVariantId: 501,
      ingredients: [{ variantId: 601, percentage: 20 }],
    });
    expect(await screen.findByText('Custom blend added to your cart')).toBeInTheDocument();
    // The success screen must render the shared note verbatim: dropping the cancellation clause
    // reads as "this order is now final" at the highest-salience moment of the flow.
    expect(screen.getByText(CUSTOM_BLEND_MADE_TO_ORDER_NOTE)).toBeInTheDocument();
    expect(screen.getByText(/cancel the order until it is dispatched/)).toBeInTheDocument();
  });

  it('keeps a sold-out ingredient selectable behind an informational badge', async () => {
    vi.mocked(getCustomBlendOptions).mockResolvedValue(
      optionsFor('Portland Cement', [option(601, 'Chalk Filler', { stockCount: 0 })]),
    );
    renderPage('?baseVariantId=501');

    expect(await screen.findByLabelText('Chalk Filler')).toBeEnabled();
    expect(screen.getByText('Out of stock')).toBeInTheDocument();
  });

  /**
   * Regression: `/api/products` returns no `variants`, so a picker that filtered rows on a sack
   * variant from the list response offered nothing at all and the feature was unreachable. The
   * eligible sack must be resolved from the product detail read at selection time instead.
   */
  it('offers bases from a list response that carries no variants', async () => {
    const user = userEvent.setup();
    const listRow = { ...configuredLine().product, id: '602', name: 'Fine Sand' };
    vi.mocked(useProducts).mockReturnValue({
      products: [listRow],
      isLoading: false,
      error: null,
      total: 1,
      currentPage: 1,
      currentPageSize: 12,
      refetch: vi.fn(),
    });
    vi.mocked(getProduct).mockResolvedValue(
      detailProduct(listRow, [
        option(602, 'Fine Sand').variant,
        { ...option(603, 'Fine Sand').variant, weightGrams: 1_000_000 },
      ]),
    );
    vi.mocked(getCustomBlendOptions).mockResolvedValue(
      optionsFor('Fine Sand', [option(701, 'Fresh Filler')]),
    );

    renderPage('');

    await user.click(await screen.findByRole('button', { name: 'Use Fine Sand as base' }));

    // The 25 kg sack is chosen over the pallet, and only after the detail read resolves it.
    await waitFor(() => {
      expect(getProduct).toHaveBeenCalledWith('602');
    });
    expect(await screen.findByRole('heading', { name: 'Base material' })).toBeInTheDocument();
    expect(getCustomBlendOptions).toHaveBeenCalledWith(602, expect.anything());
  });

  it('reports a material that has no 25 kg sack instead of selecting a wrong lot', async () => {
    const user = userEvent.setup();
    const listRow = { ...configuredLine().product, id: '604', name: 'Pallet Only Material' };
    vi.mocked(useProducts).mockReturnValue({
      products: [listRow],
      isLoading: false,
      error: null,
      total: 1,
      currentPage: 1,
      currentPageSize: 12,
      refetch: vi.fn(),
    });
    vi.mocked(getProduct).mockResolvedValue(
      detailProduct(listRow, [
        { ...option(605, 'Pallet Only Material').variant, weightGrams: 1_000_000 },
      ]),
    );

    renderPage('');

    await user.click(
      await screen.findByRole('button', { name: 'Use Pallet Only Material as base' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That material is not stocked in a 25 kg sack',
    );
    expect(getCustomBlendOptions).not.toHaveBeenCalled();
  });

  it('falls back to the base picker when the base variant query value is unusable', async () => {
    renderPage('?baseVariantId=not-a-number');

    expect(
      await screen.findByText(
        'That base material is not available for Custom Blend. Choose another base below.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Search materials')).toBeInTheDocument();
    expect(screen.getByLabelText('Category')).toBeInTheDocument();
    expect(getCustomBlendOptions).not.toHaveBeenCalled();
  });

  it('recovers to the base picker when the server rejects an ineligible base lot', async () => {
    vi.mocked(getCustomBlendOptions).mockRejectedValue(
      new Error('Selected base lot is not eligible for Custom Blend.'),
    );
    renderPage('?baseVariantId=999');

    expect(
      await screen.findByText('Selected base lot is not eligible for Custom Blend.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Search materials')).toBeInTheDocument();
  });

  it('ignores an options response that arrives after the base lot changed', async () => {
    const user = userEvent.setup();
    const stale = deferred<CustomBlendOptionsResponse>();
    vi.mocked(getCustomBlendOptions)
      .mockReturnValueOnce(stale.promise)
      .mockResolvedValueOnce(optionsFor('Fresh Base', [option(701, 'Fresh Ingredient')]));

    function BaseSwitcher() {
      const [, setSearchParams] = useSearchParams();
      return (
        <button type="button" onClick={() => setSearchParams({ baseVariantId: '502' })}>
          switch base
        </button>
      );
    }
    renderPage('?baseVariantId=501', <BaseSwitcher />);

    await waitFor(() => expect(getCustomBlendOptions).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole('button', { name: 'switch base' }));
    expect(await screen.findByLabelText('Fresh Ingredient')).toBeInTheDocument();

    await act(async () => {
      stale.resolve(optionsFor('Stale Base', [option(601, 'Stale Ingredient')]));
      await stale.promise;
    });

    expect(screen.queryByLabelText('Stale Ingredient')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Fresh Ingredient')).toBeInTheDocument();
  });

  it('locks the base lot and quantity when editing an existing configured line', async () => {
    const user = userEvent.setup();
    mockCart({
      id: 'cart',
      items: [configuredLine()],
      subtotalCents: 10_900,
      discountableSubtotalCents: 8_400,
      blendingFeeTotalCents: 2_500,
      totalItems: 7,
    });
    vi.mocked(getCustomBlendOptions).mockResolvedValue(
      optionsFor('Portland Cement', [option(601, 'Chalk Filler'), option(602, 'Fine Sand')]),
    );
    renderPage(`?baseVariantId=501&editConfigKey=${EDIT_CONFIG_KEY}`);

    expect(await screen.findByLabelText('Chalk Filler')).toBeChecked();
    expect(screen.getByLabelText('Chalk Filler percentage')).toHaveValue(30);
    expect(screen.getByRole('status')).toHaveTextContent('Base 70% · ingredients 30%');
    expect(
      screen.getByText(
        'Quantity: 7 sacks. Base material and quantity stay fixed while editing a blend.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Change base material' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Update blend' }));
    expect(replaceCustomBlend).toHaveBeenCalledWith({
      baseVariantId: 501,
      configKey: EDIT_CONFIG_KEY,
      ingredients: [{ variantId: 601, percentage: 30 }],
    });
    expect(await screen.findByText('Custom blend updated')).toBeInTheDocument();
    expect(screen.getByText(CUSTOM_BLEND_MADE_TO_ORDER_NOTE)).toBeInTheDocument();
  });

  it('creates a new blend after recovering from a failed edit onto a different base lot', async () => {
    const user = userEvent.setup();
    mockCart({
      id: 'cart',
      items: [configuredLine()],
      subtotalCents: 10_900,
      discountableSubtotalCents: 8_400,
      blendingFeeTotalCents: 2_500,
      totalItems: 7,
    });
    // The edit draft hydrates from the cart, then the options call for its base lot fails, so
    // the only offered control is the picker recovery.
    vi.mocked(getCustomBlendOptions)
      .mockRejectedValueOnce(new Error('Selected base lot is not eligible for Custom Blend.'))
      .mockResolvedValue(optionsFor('Fine Sand', [option(701, 'Fresh Filler')]));
    mockProducts([pickerProduct(602, 'Fine Sand')]);
    renderPage(`?baseVariantId=501&editConfigKey=${EDIT_CONFIG_KEY}`);

    await user.click(await screen.findByRole('button', { name: 'Choose another base' }));
    await user.click(await screen.findByRole('button', { name: 'Use Fine Sand as base' }));

    expect(
      await screen.findByRole('heading', { name: 'Build a custom blend' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Base material and quantity stay fixed/)).not.toBeInTheDocument();

    await user.click(await screen.findByLabelText('Fresh Filler'));
    fireEvent.change(screen.getByLabelText('Fresh Filler percentage'), { target: { value: '20' } });
    await user.click(screen.getByRole('button', { name: 'Add blend to cart' }));

    expect(replaceCustomBlend).not.toHaveBeenCalled();
    expect(addCustomBlend).toHaveBeenCalledWith({
      baseVariantId: 602,
      ingredients: [{ variantId: 701, percentage: 20 }],
    });
  });

  it('clears the edit draft when the target returns to a plain create URL', async () => {
    const user = userEvent.setup();
    mockCart({
      id: 'cart',
      items: [configuredLine()],
      subtotalCents: 10_900,
      discountableSubtotalCents: 8_400,
      blendingFeeTotalCents: 2_500,
      totalItems: 7,
    });
    vi.mocked(getCustomBlendOptions).mockResolvedValue(
      optionsFor('Portland Cement', [option(601, 'Chalk Filler')]),
    );

    // Same route, changed query: react-router keeps this component mounted.
    function LeaveEdit() {
      const [, setSearchParams] = useSearchParams();
      return (
        <button type="button" onClick={() => setSearchParams({ baseVariantId: '501' })}>
          leave edit
        </button>
      );
    }
    renderPage(`?baseVariantId=501&editConfigKey=${EDIT_CONFIG_KEY}`, <LeaveEdit />);

    expect(await screen.findByLabelText('Chalk Filler')).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'leave edit' }));

    expect(
      await screen.findByRole('heading', { name: 'Build a custom blend' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Chalk Filler')).not.toBeChecked();
    expect(screen.queryByText(/Base material and quantity stay fixed/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change base material' })).toBeInTheDocument();

    await user.click(screen.getByLabelText('Chalk Filler'));
    fireEvent.change(screen.getByLabelText('Chalk Filler percentage'), { target: { value: '20' } });
    await user.click(screen.getByRole('button', { name: 'Add blend to cart' }));

    expect(replaceCustomBlend).not.toHaveBeenCalled();
    expect(addCustomBlend).toHaveBeenCalledWith({
      baseVariantId: 501,
      ingredients: [{ variantId: 601, percentage: 20 }],
    });
  });

  it('offers a recoverable path when the edited line is no longer in the cart', async () => {
    vi.mocked(getCustomBlendOptions).mockResolvedValue(
      optionsFor('Portland Cement', [option(601, 'Chalk Filler')]),
    );
    renderPage(`?baseVariantId=501&editConfigKey=${'c'.repeat(64)}`);

    expect(
      await screen.findByText(
        'That custom blend is no longer in your cart. Start a new blend to continue.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start a new blend' })).toBeInTheDocument();
  });
});
