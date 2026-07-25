import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CartLine } from '@shop/contracts/cart';
import { describe, expect, it, vi } from 'vitest';
import { CartLineItem } from './CartLineItem';

const item: CartLine = {
  productId: '1',
  product: {
    id: '1',
    name: 'Pallet material',
    description: 'Test material.',
    priceCents: 1000,
    imageSetId: 'test-material',
    category: 'Trade',
    stock: 10,
    availability: 'in_stock',
    backorderable: false,
    backorderLeadDays: null,
    slug: 'test-material',
    salesCount: 0,
    createdAt: '2026-07-14T00:00:00.000Z',
    available: true,
    tags: [],
    specificationGroups: [],
  },
  variantSnap: {
    variantId: 102,
    sku: 'MAT-102',
    label: '1 tonne pallet',
    weightGrams: 1000000,
    deliveryClass: 'freight',
  },
  perTonneCents: 100000,
  resolvedUnitPriceCents: 1000,
  quantity: 1,
  lineTotalCents: 1000,
};

describe('CartLineItem', () => {
  it('renders the server-resolved pack price without recalculating the line total', () => {
    render(
      <CartLineItem
        item={{ ...item, quantity: 4, lineTotalCents: 3_999 }}
        onUpdateQuantity={vi.fn().mockResolvedValue(true)}
        onRemove={vi.fn().mockResolvedValue(true)}
      />,
    );

    expect(screen.getByText('Resolved pack price: $10.00')).toBeInTheDocument();
  });

  it('passes the line variant identity to quantity and remove callbacks', async () => {
    const user = userEvent.setup();
    const onUpdateQuantity = vi.fn().mockResolvedValue(true);
    const onRemove = vi.fn().mockResolvedValue(true);
    render(<CartLineItem item={item} onUpdateQuantity={onUpdateQuantity} onRemove={onRemove} />);

    await user.click(screen.getByRole('button', { name: 'Increase quantity' }));
    await user.click(screen.getByRole('button', { name: 'Remove' }));

    expect(onUpdateQuantity).toHaveBeenCalledWith('1', 2, 102);
    expect(onRemove).toHaveBeenCalledWith('1', 102);
  });
});
