import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Cart, CartLine } from '@shop/contracts/cart';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { useCartContext } from '@/hooks/CartContext';
import type { useCart } from '@/hooks/useCart';
import { CartSheet } from './CartSheet';

vi.mock('@/hooks/CartContext', () => ({ useCartContext: vi.fn() }));

const plainLine: CartLine = {
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
    variantId: 1,
    sku: 'MAT-001',
    label: '25kg sack',
    weightGrams: 25000,
    deliveryClass: 'freight',
  },
  perTonneCents: 40000,
  resolvedUnitPriceCents: 1000,
  quantity: 1,
  configKey: '',
  materialSubtotalCents: 1000,
  blendingFeeCents: 0,
  discountableTotalCents: 1000,
  lineTotalCents: 1000,
};

const CONFIG_KEY_A = 'a'.repeat(64);
const CONFIG_KEY_B = 'b'.repeat(64);

/**
 * Two configured lines over the SAME base variant, distinguished only by config key. The sheet is a
 * second renderer of the same cart lines as the cart page, so it needs its own proof that the
 * shared identity helpers are wired through here too.
 */
function blendLine(configKey: string, fillerName: string, quantity: number): CartLine {
  return {
    ...plainLine,
    configKey,
    quantity,
    blendingFeeCents: 2_500,
    lineTotalCents: 3_500,
    customBlend: {
      configKey,
      basePercentage: 80,
      mixingGroup: 'mineral',
      ingredients: [
        {
          variantId: 601,
          productId: '11',
          productName: fillerName,
          productDescription: 'Filler',
          mixingGroup: 'mineral',
          percentage: 20,
        },
      ],
      blendingFeeCents: 2_500,
      madeToOrder: true,
      returnable: false,
    },
  };
}

const twoBlendCart: Cart = {
  id: '58f1b5ed-3dbf-4c3c-908e-c71d7e7bf912',
  items: [blendLine(CONFIG_KEY_A, 'Chalk Filler', 1), blendLine(CONFIG_KEY_B, 'Silica Flour', 4)],
  subtotalCents: 12_000,
  discountableSubtotalCents: 7_000,
  blendingFeeTotalCents: 5_000,
  totalItems: 5,
  deliveryPreview: {
    mode: 'freight',
    chargeCents: 999,
    weightGrams: 125000,
    reason: 'Freight threshold reached',
  },
};

interface CartContextOverrides {
  updateQuantity?: ReturnType<typeof vi.fn>;
  isActionPending?: ReturnType<typeof vi.fn>;
}

function renderSheet(cart: Cart, overrides: CartContextOverrides = {}) {
  vi.mocked(useCartContext).mockReturnValue({
    cart,
    isLoading: false,
    isInitializing: false,
    error: null,
    updateQuantity: overrides.updateQuantity ?? vi.fn(),
    removeItem: vi.fn(),
    retryCart: vi.fn(),
    isActionPending: overrides.isActionPending ?? vi.fn(),
  } as unknown as ReturnType<typeof useCart>);
  return render(
    <MemoryRouter>
      <CartSheet />
    </MemoryRouter>,
  );
}

async function openSheet(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /Open cart/ }));
}

describe('CartSheet', () => {
  it('keeps two blends over one base variant as independent lines keyed by config key', async () => {
    const user = userEvent.setup();
    const updateQuantity = vi.fn().mockResolvedValue(true);
    const isActionPending = vi.fn().mockReturnValue(false);
    // React only reports colliding list keys through console.error, so a lost config-key segment is
    // otherwise silent.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    renderSheet(twoBlendCart, { updateQuantity, isActionPending });
    await openSheet(user);

    // Both compositions reach the screen: neither line is collapsed into or overwritten by the other.
    expect(await screen.findByText('80% Pallet material — 20% Chalk Filler')).toBeInTheDocument();
    expect(screen.getByText('80% Pallet material — 20% Silica Flour')).toBeInTheDocument();

    const duplicateKeyWarnings = consoleError.mock.calls.filter((call) =>
      call.some((argument) => String(argument).includes('same key')),
    );
    consoleError.mockRestore();
    expect(duplicateKeyWarnings).toEqual([]);

    // Pending state is queried per config key, so a spinner on one line cannot disable the other.
    expect(isActionPending).toHaveBeenCalledWith('1', 'update', 1, CONFIG_KEY_A);
    expect(isActionPending).toHaveBeenCalledWith('1', 'update', 1, CONFIG_KEY_B);
    expect(isActionPending).toHaveBeenCalledWith('1', 'remove', 1, CONFIG_KEY_A);
    expect(isActionPending).toHaveBeenCalledWith('1', 'remove', 1, CONFIG_KEY_B);

    const lineB = screen.getByText('80% Pallet material — 20% Silica Flour').closest('div.py-3');
    expect(lineB).not.toBeNull();
    await user.click(
      within(lineB as HTMLElement).getByRole('button', { name: 'Increase quantity' }),
    );

    // Line B holds quantity 4, so the mutation must carry 5 and B's own config key.
    expect(updateQuantity).toHaveBeenCalledTimes(1);
    expect(updateQuantity).toHaveBeenCalledWith('1', 5, 1, CONFIG_KEY_B);
  });

  it('separates material subtotal from blending fees in the sheet summary', async () => {
    const user = userEvent.setup();

    renderSheet(twoBlendCart);
    await openSheet(user);

    expect(await screen.findByText('Material subtotal')).toBeInTheDocument();
    expect(screen.getByText('Blending fees')).toBeInTheDocument();
    expect(screen.getByText('$50.00')).toBeInTheDocument();
    expect(screen.getByText('$70.00')).toBeInTheDocument();
  });

  it('omits the blending fee breakdown when the order holds no configured line', async () => {
    const user = userEvent.setup();

    renderSheet({
      ...twoBlendCart,
      items: [plainLine],
      totalItems: 1,
      subtotalCents: 1000,
      discountableSubtotalCents: 1000,
      blendingFeeTotalCents: 0,
    });
    await openSheet(user);

    expect(await screen.findByText('Resolved order subtotal')).toBeInTheDocument();
    expect(screen.queryByText('Blending fees')).not.toBeInTheDocument();
    expect(screen.queryByText('Material subtotal')).not.toBeInTheDocument();
  });
});
