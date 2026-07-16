import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Product } from '@shop/contracts/products';
import { ComponentPicker, useComponentPicker } from './ComponentPicker';
import { MixOptions } from './MixOptions';
import { RatioEditor } from './RatioEditor';

const metadata = {
  createdAt: '2026-07-14T00:00:00.000Z',
  available: true,
  tags: [],
  specificationGroups: [],
};

const products: Product[] = [
  {
    id: '1',
    name: 'Protein Powder',
    description: 'Protein',
    priceCents: 1200,
    imageSetId: 'protein',
    category: 'Performance',
    stock: 8,
    slug: 'protein',
    salesCount: 1,
    ...metadata,
    mixable: true,
    mixUnitGrams: 500,
  },
  {
    id: '2',
    name: 'Cocoa Powder',
    description: 'Cocoa',
    priceCents: 800,
    imageSetId: 'cocoa',
    category: 'Pantry Staples',
    stock: 8,
    slug: 'cocoa',
    salesCount: 1,
    ...metadata,
    mixable: true,
    mixUnitGrams: 250,
  },
];

function TestComponentPicker({
  selectedProductIds,
  onAdd,
}: {
  selectedProductIds: string[];
  onAdd: (productId: string) => void;
}) {
  const picker = useComponentPicker(products, selectedProductIds);
  return <ComponentPicker picker={picker} selectedProductIds={selectedProductIds} onAdd={onAdd} />;
}

describe('Powderizer builder controls', () => {
  it('exposes accessible selection and ratio controls, including live invalid totals', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    const onPercentageChange = vi.fn();
    render(
      <>
        <TestComponentPicker selectedProductIds={['1']} onAdd={onAdd} />
        <RatioEditor
          components={[
            { productId: '1', percentage: 99 },
            { productId: '2', percentage: 99 },
          ]}
          products={products}
          onPercentageChange={onPercentageChange}
          onRemove={vi.fn()}
          onEqualSplit={vi.fn()}
        />
      </>,
    );
    expect(screen.getByRole('button', { name: 'Selected' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Pantry Staples' }));
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(onAdd).toHaveBeenCalledWith('2');
    expect(screen.getByText('Ratio total: 198% — must equal 100%')).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Protein Powder percentage'));
    expect(onPercentageChange).toHaveBeenLastCalledWith('1', 0);
  });

  it('uses grouped radio options and NFC grapheme counter for label input', () => {
    const onLabelChange = vi.fn();
    const { rerender } = render(
      <MixOptions
        config={{
          components: [],
          bagSizeGrams: 500,
          fineness: 'standard',
          customLabel: '',
          bagColourScheme: 'ultraviolet-cyan',
        }}
        bagSizes={[250, 500, 1000]}
        finenessValues={['coarse', 'standard', 'fine']}
        labelMaxGraphemes={40}
        onBagSizeChange={vi.fn()}
        onFinenessChange={vi.fn()}
        onLabelChange={onLabelChange}
      />,
    );
    expect(screen.getByRole('group', { name: '3. Bag size' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: '4. Fineness' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Bag label/), { target: { value: '🍫' } });
    expect(onLabelChange).toHaveBeenLastCalledWith('🍫');
    rerender(
      <MixOptions
        config={{
          components: [],
          bagSizeGrams: 500,
          fineness: 'standard',
          customLabel: '🍫',
          bagColourScheme: 'ultraviolet-cyan',
        }}
        bagSizes={[250, 500, 1000]}
        finenessValues={['coarse', 'standard', 'fine']}
        labelMaxGraphemes={40}
        onBagSizeChange={vi.fn()}
        onFinenessChange={vi.fn()}
        onLabelChange={onLabelChange}
      />,
    );
    expect(screen.getByText('1 of 40 characters')).toBeInTheDocument();
  });
});
