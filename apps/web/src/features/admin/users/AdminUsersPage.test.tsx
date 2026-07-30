import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdminUsersPage } from './AdminUsersPage';
const api = vi.hoisted(() => ({
  getAdminUsers: vi.fn(),
  updateAdminUserDisplayName: vi.fn(),
  setAdminUserRole: vi.fn(),
  suspendAdminUser: vi.fn(),
  reactivateAdminUser: vi.fn(),
}));
vi.mock('@/api/adminUsers', () => api);
const user = {
  id: '1',
  email: 'buyer@example.test',
  displayName: 'Buyer',
  role: 'admin' as const,
  suspendedAt: null,
  suspensionReason: null,
  suspendedByUserId: null,
};
describe('AdminUsersPage', () => {
  afterEach(() => vi.resetAllMocks());
  it('searches and shows last-admin demotion rejection', async () => {
    api.getAdminUsers.mockResolvedValue({ items: [user] });
    api.setAdminUserRole.mockRejectedValue(new Error('Cannot demote the last administrator.'));
    const events = userEvent.setup();
    render(<AdminUsersPage />);
    expect(await screen.findByText('buyer@example.test')).toBeInTheDocument();
    await events.selectOptions(screen.getByLabelText('Role'), 'customer');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Cannot demote the last administrator.',
    );
    await events.clear(screen.getByLabelText('Search users'));
    await events.type(screen.getByLabelText('Search users'), 'buyer');
    await events.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(api.getAdminUsers).toHaveBeenLastCalledWith({ search: 'buyer' }));
  });
});
