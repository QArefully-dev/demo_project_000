import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CompanyPage } from './CompanyPage';
import * as companyApi from '@/api/companyAccounts';

vi.mock('@/api/companyAccounts', () => ({
  getCompany: vi.fn(),
  createCompany: vi.fn(),
  listMembers: vi.fn(),
  listInvites: vi.fn(),
  inviteMember: vi.fn(),
  revokeInvite: vi.fn(),
  revokeMember: vi.fn(),
  updateMemberRole: vi.fn(),
  updateThreshold: vi.fn(),
}));
const owner = {
  company: {
    id: '1',
    name: 'Acme',
    createdByUserId: '1',
    active: true,
    approvalThresholdCents: 50000,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  },
  membership: {
    id: '1',
    companyId: '1',
    userId: '1',
    role: 'owner' as const,
    active: true,
    createdAt: '2026-07-01T00:00:00.000Z',
  },
};
describe('CompanyPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });
  it('creates a company for a non-member', async () => {
    vi.mocked(companyApi.getCompany).mockResolvedValue(null);
    vi.mocked(companyApi.createCompany).mockResolvedValue(owner);
    const user = userEvent.setup();
    render(<CompanyPage />);
    await user.type(await screen.findByLabelText('Company name'), 'Acme');
    await user.click(screen.getByRole('button', { name: 'Create company' }));
    await waitFor(() => expect(companyApi.createCompany).toHaveBeenCalledWith({ name: 'Acme' }));
  });
  it('shows owner-only invite controls from fetched membership', async () => {
    vi.mocked(companyApi.getCompany).mockResolvedValue(owner);
    vi.mocked(companyApi.listMembers).mockResolvedValue([owner.membership]);
    vi.mocked(companyApi.listInvites).mockResolvedValue([]);
    render(<CompanyPage />);
    expect(await screen.findByRole('heading', { name: 'Invite a member' })).toBeInTheDocument();
  });
  it('uses exact decimal cents and rejects fractions beyond pence precision', async () => {
    vi.mocked(companyApi.getCompany).mockResolvedValue(owner);
    vi.mocked(companyApi.listMembers).mockResolvedValue([owner.membership]);
    vi.mocked(companyApi.listInvites).mockResolvedValue([]);
    vi.mocked(companyApi.updateThreshold).mockResolvedValue(owner.company);
    const user = userEvent.setup();
    render(<CompanyPage />);
    const input = await screen.findByRole('textbox', { name: /Threshold/ });
    await user.clear(input);
    await user.type(input, '1.005');
    await user.click(screen.getByRole('button', { name: 'Save threshold' }));
    expect(companyApi.updateThreshold).not.toHaveBeenCalled();
    await user.clear(input);
    await user.type(input, '1.01');
    await user.click(screen.getByRole('button', { name: 'Save threshold' }));
    await waitFor(() =>
      expect(companyApi.updateThreshold).toHaveBeenCalledWith({ approvalThresholdCents: 101 }),
    );
  });
});
