import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Product } from '@shop/contracts/products';
import { IngredientPicker } from './IngredientPicker';
import { useComponentPicker } from './useComponentPicker';

const metadata = {
  createdAt: '2026-07-14T00:00:00.000Z',
  available: true,
  availability: 'in_stock' as const,
  backorderable: false,
  backorderLeadDays: null,
  tags: [],
  specificationGroups: [],
};

function makeProduct(
  id: string,
  category: string,
  mixingGroup: string | null,
  name?: string,
): Product {
  return {
    id,
    name: name ?? `Powder ${id}`,
    description: '',
    priceCents: 1000,
    imageSetId: id,
    category,
    stock: 10,
    slug: id,
    salesCount: 1,
    ...metadata,
    mixable: true,
    mixingGroup,
  };
}

const products: Product[] = [
  makeProduct('1', 'Food', 'food-sweet', 'Sugar Powder'),
  makeProduct('2', 'Food', 'food-sweet', 'Honey Powder'),
  makeProduct('3', 'Cleaning', 'cleaning-harsh', 'Bleach Powder'),
  makeProduct('4', 'Cleaning', 'cleaning-harsh', 'Soap Powder'),
  makeProduct('5', 'Cleaning', 'cleaning-mild', 'Vinegar Powder'),
  makeProduct('6', 'Garden', null, 'Mulch Powder'),
  makeProduct('7', 'Food', 'food-sweet', 'Cinnamon Powder'),
  makeProduct('8', 'Food', 'food-sweet', 'Cocoa Powder'),
  makeProduct('9', 'Cleaning', 'cleaning-harsh', 'Ammonia Powder'),
  makeProduct('10', 'Food', 'food-sweet', 'Vanilla Powder'),
];

function TestPicker({
  selectedProductIds,
  onAdd,
}: {
  selectedProductIds: readonly string[];
  onAdd: (productId: string) => void;
}) {
  const picker = useComponentPicker(products, selectedProductIds);
  return <IngredientPicker picker={picker} selectedProductIds={selectedProductIds} onAdd={onAdd} />;
}

function EmptyTestPicker({
  selectedProductIds,
  onAdd,
}: {
  selectedProductIds: readonly string[];
  onAdd: (productId: string) => void;
}) {
  const picker = useComponentPicker([], []);
  return <IngredientPicker picker={picker} selectedProductIds={selectedProductIds} onAdd={onAdd} />;
}

describe('IngredientPicker', () => {
  it('disables incompatible mixing group products when mixed-category selected', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<TestPicker selectedProductIds={['1']} onAdd={onAdd} />);
    await user.click(screen.getByRole('button', { name: 'All powders' }));
    expect(screen.getByText(/1 of 5 powders selected/)).toBeInTheDocument();
    const incompatibleBtns = screen.getAllByRole('button', { name: 'Incompatible' });
    expect(incompatibleBtns.length).toBeGreaterThanOrEqual(1);
    for (const btn of incompatibleBtns) {
      expect(btn).toBeDisabled();
    }
    expect(screen.getAllByText(/different mix group/).length).toBeGreaterThanOrEqual(1);
  });

  it('marks products from different mixing group as Incompatible', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<TestPicker selectedProductIds={['1']} onAdd={onAdd} />);
    await user.click(screen.getByRole('button', { name: 'All powders' }));
    const incompatibleBtns = screen.getAllByRole('button', { name: 'Incompatible' });
    expect(incompatibleBtns.length).toBeGreaterThanOrEqual(1);
    for (const btn of incompatibleBtns) {
      expect(btn).toBeDisabled();
    }
    expect(screen.getAllByText(/different mix group/).length).toBeGreaterThanOrEqual(1);
  });

  it('does not restrict when selected products have no mixing group', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<TestPicker selectedProductIds={['6']} onAdd={onAdd} />);
    await user.click(screen.getByRole('button', { name: 'All powders' }));
    expect(screen.queryByText(/different mix group/)).toBeNull();
  });

  it('disables buttons at the maximum of 5 selected products', () => {
    const onAdd = vi.fn();
    const ids = ['1', '2', '7', '8', '10'];
    render(<TestPicker selectedProductIds={ids} onAdd={onAdd} />);
    const addButtons = screen.queryAllByRole('button', { name: 'Add' });
    expect(addButtons).toHaveLength(0);
  });

  it('filters by category and paginates', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<TestPicker selectedProductIds={[]} onAdd={onAdd} />);
    await user.click(screen.getByRole('button', { name: 'All powders' }));
    expect(screen.getByText(/10 results/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cleaning' }));
    expect(screen.getByText(/4 results/)).toBeInTheDocument();
    const addBtns = screen.getAllByRole('button', { name: 'Add' });
    expect(addBtns).toHaveLength(4);
  });

  it('shows empty state when no products are available', () => {
    const onAdd = vi.fn();
    render(<EmptyTestPicker selectedProductIds={[]} onAdd={onAdd} />);
    expect(screen.getByText(/No eligible powders/)).toBeInTheDocument();
  });
});
