import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useSearchParams } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getProduct } from '@/api/products';
import { useCategories } from '@/hooks/useCategories';
import { useProducts } from '@/hooks/useProducts';
import { BasePicker, SelectedBaseChip } from './BasePicker';

vi.mock('@/api/products', () => ({ getProduct: vi.fn() }));
vi.mock('@/hooks/useProducts', () => ({ useProducts: vi.fn() }));
vi.mock('@/hooks/useCategories', () => ({ useCategories: vi.fn() }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function product(id: string, name: string, category = 'Trade & Creative Materials') {
  return {
    id,
    name,
    description: `${name} description`,
    priceCents: 1_200,
    imageSetId: `set-${id}`,
    category,
    stock: 10,
    availability: 'in_stock',
    backorderable: false,
    backorderLeadDays: null,
    slug: name.toLowerCase().replaceAll(' ', '-'),
    salesCount: 0,
    createdAt: '2026-07-14T00:00:00.000Z',
    available: true,
    tags: [],
    specificationGroups: [],
    consumptionClassification: 'non-food',
    mixingGroup: 'mineral',
  };
}

function detail(variantId: number | null) {
  return {
    variants: variantId === null ? [] : [{ variantId, weightGrams: 25_000, active: true }],
  };
}

function SearchOwnedPicker() {
  const [searchParams, setSearchParams] = useSearchParams();
  return (
    <>
      <BasePicker
        onSelectBase={(variantId) => setSearchParams({ baseVariantId: String(variantId) })}
      />
      <output data-testid="base-variant-id">{searchParams.get('baseVariantId') ?? ''}</output>
    </>
  );
}

function mockCatalog(...products: ReturnType<typeof product>[]) {
  vi.mocked(useCategories).mockReturnValue({
    categories: ['Trade & Creative Materials'],
    isLoading: false,
    error: null,
  });
  vi.mocked(useProducts).mockReturnValue({
    products,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useProducts>);
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('BasePicker', () => {
  it('renders resolved packaging artwork, a category badge, and its mixing group', () => {
    mockCatalog(product('40', 'Yellow Ochre'));

    render(<BasePicker onSelectBase={vi.fn()} />);

    expect(screen.getByLabelText('Yellow Ochre packaging')).toBeInTheDocument();
    expect(
      screen.getByText('Trade & Creative Materials', { selector: '[data-slot="badge"]' }),
    ).toBeInTheDocument();
    expect(screen.getByText('mineral blend group')).toBeInTheDocument();
  });

  it('uses the generic packaging fallback when no catalog palette resolves', () => {
    mockCatalog(product('not-a-canonical-id', 'Unmapped Material'));

    render(<BasePicker onSelectBase={vi.fn()} />);

    expect(screen.getByLabelText('Unmapped Material packaging unavailable')).toBeInTheDocument();
    expect(screen.queryByLabelText('Unmapped Material packaging')).not.toBeInTheDocument();
  });

  it('keeps an ineligible-sack failure on the failed card only', async () => {
    const user = userEvent.setup();
    mockCatalog(product('40', 'No Sack'), product('41', 'Available Sack'));
    vi.mocked(getProduct).mockResolvedValueOnce(detail(null) as never);

    render(<BasePicker onSelectBase={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Use No Sack as base' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('not stocked in a 25 kg sack');
    expect(
      screen.getByRole('button', { name: 'Use Available Sack as base' }).closest('li'),
    ).not.toHaveTextContent('not stocked in a 25 kg sack');
  });

  it('keeps sequential resolve failures on their respective cards', async () => {
    const user = userEvent.setup();
    mockCatalog(product('40', 'First Failure'), product('41', 'Second Failure'));
    vi.mocked(getProduct)
      .mockResolvedValueOnce(detail(null) as never)
      .mockResolvedValueOnce(detail(null) as never);

    render(<BasePicker onSelectBase={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Use First Failure as base' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('not stocked in a 25 kg sack');

    await user.click(screen.getByRole('button', { name: 'Use Second Failure as base' }));
    await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(2));

    expect(
      screen.getByRole('button', { name: 'Use First Failure as base' }).closest('li'),
    ).toHaveTextContent('not stocked in a 25 kg sack');
    expect(
      screen.getByRole('button', { name: 'Use Second Failure as base' }).closest('li'),
    ).toHaveTextContent('not stocked in a 25 kg sack');
  });

  it('lets the URL owner write the selected 25 kg variant id', async () => {
    const user = userEvent.setup();
    mockCatalog(product('40', 'Yellow Ochre'));
    vi.mocked(getProduct).mockResolvedValueOnce(detail(901) as never);

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <SearchOwnedPicker />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('button', { name: 'Use Yellow Ochre as base' }));

    expect(await screen.findByTestId('base-variant-id')).toHaveTextContent('901');
  });

  it('drops a stale product resolve after a newer card selection', async () => {
    const user = userEvent.setup();
    const first = deferred<ReturnType<typeof detail>>();
    const second = deferred<ReturnType<typeof detail>>();
    const onSelectBase = vi.fn();
    mockCatalog(product('40', 'Earlier Material'), product('41', 'Current Material'));
    vi.mocked(getProduct)
      .mockReturnValueOnce(first.promise as never)
      .mockReturnValueOnce(second.promise as never);

    render(<BasePicker onSelectBase={onSelectBase} />);
    await user.click(screen.getByRole('button', { name: 'Use Earlier Material as base' }));
    await user.click(screen.getByRole('button', { name: 'Use Current Material as base' }));

    second.resolve(detail(902));
    await waitFor(() => expect(onSelectBase).toHaveBeenCalledWith(902));
    first.resolve(detail(901));
    await waitFor(() => expect(onSelectBase).toHaveBeenCalledTimes(1));
  });

  it('renders the selected base as an option-backed artwork chip', () => {
    render(
      <SelectedBaseChip
        base={{
          productId: '40',
          productName: 'Yellow Ochre',
          productDescription: 'Pigment',
          mixingGroup: 'mineral',
          category: 'Trade & Creative Materials',
          consumptionClassification: 'non-food',
          categoryFacts: {
            texture: 'Fine powder',
            colour: 'Yellow',
            source: 'Mineral',
            intendedUse: 'Pigment',
            storage: 'Keep dry',
            consumptionClassification: 'non-food',
            composition: 'Iron oxide',
            waterRatio: 'Not applicable',
            coverage: 'Not applicable',
            settingTime: 'Not applicable',
            ppe: ['Gloves'],
          },
          variant: {
            variantId: 901,
            productId: 40,
            sku: 'MAT-901',
            label: '25 kg sack',
            weightGrams: 25_000,
            priceCents: 1_200,
            moqSacks: 1,
            perTonneCents: 48_000,
            priceTiers: [],
            stockCount: 4,
            backorderable: false,
            backorderLeadDays: null,
            deliveryClass: 'freight',
            active: true,
            sortOrder: 1,
          },
        }}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Yellow Ochre packaging')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change base material' })).toBeInTheDocument();
  });
});
