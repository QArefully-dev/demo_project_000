import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdminPromosPage } from './AdminPromosPage';
const api = vi.hoisted(() => ({
  getAdminPromos: vi.fn(),
  createAdminPromo: vi.fn(),
  updateAdminPromo: vi.fn(),
  deactivateAdminPromo: vi.fn(),
}));
vi.mock('@/api/adminPromos', () => api);
const promo = {
  code: 'TRADE10',
  active: true,
  redemptionCount: 0,
  discountPercent: 10,
  minItemCount: 0,
  kind: 'percent' as const,
  amountCents: null,
  minSubtotalCents: null,
  categoryScope: null,
  startAt: null,
  endAt: null,
  maxRedemptions: null,
  perUserLimit: null,
};
describe('AdminPromosPage', () => {
  afterEach(() => vi.resetAllMocks());
  it('creates a promotion through the typed client', async () => {
    api.getAdminPromos.mockResolvedValue({ items: [promo] });
    api.createAdminPromo.mockResolvedValue({ ...promo, code: 'NEW10' });
    const user = userEvent.setup();
    render(<AdminPromosPage />);
    await screen.findByText('TRADE10');
    await user.click(screen.getByRole('button', { name: 'New promotion' }));
    await user.type(screen.getByLabelText('Code'), 'new10');
    await user.clear(screen.getByLabelText('Discount percent'));
    await user.type(screen.getByLabelText('Discount percent'), '10');
    await user.click(screen.getByRole('button', { name: 'Save promotion' }));
    await waitFor(() =>
      expect(api.createAdminPromo).toHaveBeenCalledWith(expect.objectContaining({ code: 'NEW10' })),
    );
  });
  it('shows a deactivation failure', async () => {
    api.getAdminPromos.mockResolvedValue({ items: [promo] });
    api.deactivateAdminPromo.mockRejectedValue(new Error('Promotion already redeemed'));
    const user = userEvent.setup();
    render(<AdminPromosPage />);
    await user.click(await screen.findByRole('button', { name: 'TRADE10 Active' }));
    await user.click(screen.getByRole('button', { name: 'Deactivate promotion' }));
    await user.click(screen.getByRole('button', { name: 'Confirm deactivate' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Promotion already redeemed');
  });
  it('serialises only update fields when editing a promotion', async () => {
    api.getAdminPromos.mockResolvedValue({ items: [promo] });
    api.updateAdminPromo.mockResolvedValue(promo);
    const user = userEvent.setup();
    render(<AdminPromosPage />);
    await user.click(await screen.findByRole('button', { name: 'TRADE10 Active' }));
    await user.selectOptions(screen.getByLabelText('Category scope'), 'Drinks');
    await user.clear(screen.getByLabelText('Maximum redemptions'));
    await user.type(screen.getByLabelText('Maximum redemptions'), '20');
    await user.click(screen.getByRole('button', { name: 'Save promotion' }));
    await waitFor(() =>
      expect(api.updateAdminPromo).toHaveBeenCalledWith(
        'TRADE10',
        expect.objectContaining({ categoryScope: 'Drinks', maxRedemptions: 20 }),
      ),
    );
    const updateCall = api.updateAdminPromo.mock.calls[0] as unknown;
    if (!updateCall) throw new Error('Expected promotion update request.');
    if (!Array.isArray(updateCall)) throw new Error('Expected promotion update arguments.');
    const [, update] = updateCall as [unknown, unknown];
    expect(update).not.toHaveProperty('code');
    expect(update).not.toHaveProperty('active');
    expect(update).not.toHaveProperty('redemptionCount');
  });
});
