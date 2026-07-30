import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdminVariantsPage } from './AdminVariantsPage';
const api = vi.hoisted(() => ({
  getAdminProductVariants: vi.fn(),
  createAdminVariant: vi.fn(),
  updateAdminVariant: vi.fn(),
  retireAdminVariant: vi.fn(),
  setAdminVariantClearance: vi.fn(),
}));
vi.mock('@/api/adminVariants', () => api);
const variant = {
  id: '2',
  productId: '1',
  sku: 'CEM-25',
  label: '25kg sack',
  weightGrams: 25000,
  priceCents: 900,
  moqSacks: 1,
  compareAtPriceCents: null,
  clearance: null,
  stockCount: 3,
  backorderable: false,
  backorderLeadDays: null,
  deliveryClass: 'freight' as const,
  active: true,
  sortOrder: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
describe('AdminVariantsPage', () => {
  afterEach(() => vi.resetAllMocks());
  it('saves clearance through the API', async () => {
    api.getAdminProductVariants.mockResolvedValue({ items: [variant] });
    api.setAdminVariantClearance.mockResolvedValue({
      ...variant,
      clearance: {
        priceCents: 800,
        startsAt: '2026-01-01T00:00:00.000Z',
        endsAt: '2026-01-02T00:00:00.000Z',
      },
    });
    const user = userEvent.setup();
    render(<AdminVariantsPage />);
    await user.click(await screen.findByRole('button', { name: /25kg sack/ }));
    await user.click(screen.getByLabelText('Enable clearance'));
    await user.click(screen.getByRole('button', { name: 'Save clearance' }));
    await waitFor(() =>
      expect(api.setAdminVariantClearance).toHaveBeenCalledWith(
        '2',
        expect.objectContaining({ clearance: {} }),
      ),
    );
  });
  it('shows retirement rejection', async () => {
    api.getAdminProductVariants.mockResolvedValue({ items: [variant] });
    api.retireAdminVariant.mockRejectedValue(new Error('Lot has order references'));
    const user = userEvent.setup();
    render(<AdminVariantsPage />);
    await user.click(await screen.findByRole('button', { name: /25kg sack/ }));
    await user.click(screen.getByRole('button', { name: 'Retire lot' }));
    await user.click(screen.getByRole('button', { name: 'Confirm retire' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Lot has order references');
  });
});
