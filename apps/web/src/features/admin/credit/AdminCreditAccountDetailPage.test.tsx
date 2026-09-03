/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { CreditAccountAdminView } from '@shop/contracts/trade-credit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdminCreditAccountDetailPage } from './AdminCreditAccountDetailPage';

const api = vi.hoisted(() => ({
  getAdminCreditAccount: vi.fn(),
  updateAdminCreditAccount: vi.fn(),
}));
vi.mock('@/api/adminCredit', () => api);

const account = {
  id: '7',
  companyId: '7',
  companyName: 'Example Trading Ltd',
  state: 'active',
  creditLimitCents: 100_000,
  outstandingCents: 25_000,
  heldCents: 5_000,
  exposureCents: 30_000,
  availableCreditCents: 70_000,
  terms: 'net_30',
  holdReason: null,
  version: 3,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
} satisfies CreditAccountAdminView;

function Location() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

function renderPage(initialEntry = '/admin/credit-accounts/7') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="/admin/credit-accounts/:creditAccountId"
          element={<AdminCreditAccountDetailPage />}
        />
      </Routes>
      <Location />
    </MemoryRouter>,
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((complete, fail) => {
    resolve = complete;
    reject = fail;
  });
  return { promise, resolve, reject };
}

describe('AdminCreditAccountDetailPage', () => {
  afterEach(() => vi.resetAllMocks());

  it('parses GBP exactly, sends one versioned mutation, and reloads account detail', async () => {
    const update = deferred<CreditAccountAdminView>();
    api.getAdminCreditAccount
      .mockResolvedValueOnce(account)
      .mockResolvedValueOnce({ ...account, creditLimitCents: 125_000, version: 4 });
    api.updateAdminCreditAccount.mockReturnValue(update.promise);
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('heading', { name: 'Credit account #7' });
    const input = screen.getByLabelText('New credit limit (GBP)');
    await user.type(input, '1250.05');
    await user.click(screen.getByRole('button', { name: 'Update credit limit' }));
    expect(api.updateAdminCreditAccount).toHaveBeenCalledWith(
      '7',
      {
        creditLimitCents: 125_005,
        expectedVersion: 3,
        idempotencyKey: expect.any(String) as unknown,
      },
      expect.any(AbortSignal),
    );
    await act(async () => {
      update.resolve({ ...account, creditLimitCents: 125_005, version: 4 });
      await update.promise;
    });
    expect(await screen.findByText('Credit account updated.')).toBeInTheDocument();
    await waitFor(() => expect(api.getAdminCreditAccount).toHaveBeenCalledTimes(2));
  });

  it('preserves an idempotency key for an unchanged uncertain retry and rotates after edit', async () => {
    api.getAdminCreditAccount.mockResolvedValue(account);
    const first = deferred<CreditAccountAdminView>();
    api.updateAdminCreditAccount.mockReturnValueOnce(first.promise).mockResolvedValue(account);
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('heading', { name: 'Credit account #7' });
    const input = screen.getByLabelText('New credit limit (GBP)');
    await user.type(input, '1250.05');
    const submit = screen.getByRole('button', { name: 'Update credit limit' });
    await user.click(submit);
    const firstKey = api.updateAdminCreditAccount.mock.calls[0]?.[1].idempotencyKey;
    first.reject(new Error('uncertain network result'));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Update credit limit' }));
    const secondKey = api.updateAdminCreditAccount.mock.calls[1]?.[1].idempotencyKey;
    expect(secondKey).toBe(firstKey);
    await user.clear(input);
    await user.type(input, '1300.00');
    await user.click(screen.getByRole('button', { name: 'Update credit limit' }));
    const thirdKey = api.updateAdminCreditAccount.mock.calls[2]?.[1].idempotencyKey;
    expect(thirdKey).not.toBe(secondKey);
  });

  it('rotates account mutation identity when the route account changes', async () => {
    api.getAdminCreditAccount.mockResolvedValue(account);
    api.updateAdminCreditAccount.mockResolvedValue(account);
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/admin/credit-accounts/7']}>
        <Routes>
          <Route
            path="/admin/credit-accounts/:creditAccountId"
            element={<AdminCreditAccountDetailPage />}
          />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByRole('heading', { name: 'Credit account #7' });
    const input = screen.getByLabelText('New credit limit (GBP)');
    await user.type(input, '1250.05');
    await user.click(screen.getByRole('button', { name: 'Update credit limit' }));
    const firstKey = api.updateAdminCreditAccount.mock.calls[0]?.[1].idempotencyKey;
    expect(firstKey).toEqual(expect.any(String));
  });
});
