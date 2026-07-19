import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { AdminReviewQueueResponse } from '@shop/contracts/reviews';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdminReviewModerationPage } from './AdminReviewModerationPage';

const api = vi.hoisted(() => ({
  getAdminReviewQueue: vi.fn(),
  moderateAdminReview: vi.fn(),
  restoreAdminReview: vi.fn(),
}));

vi.mock('@/api/adminReviews', () => api);

const item = {
  id: 'review-1',
  productId: 'product-1',
  productName: 'Impossible Powder',
  productSlug: 'impossible-powder',
  author: { displayName: 'Review author' },
  rating: 4,
  body: 'This review is long enough to meet its public review body constraint.',
  verifiedPurchase: true,
  helpfulCount: 3,
  viewerCanEngage: false,
  viewerHasHelpfulVote: false,
  viewerHasOpenReport: false,
  status: 'published' as const,
  createdAt: '2026-07-14T00:00:00.000Z',
  updatedAt: '2026-07-14T00:00:00.000Z',
  openReportCount: 1,
  openReports: [
    {
      id: 'report-1',
      reporterId: 'reporter-1',
      reporterDisplayName: 'Report author',
      reason: 'unsafe' as const,
      detail: '<b>Inert report detail</b>',
      createdAt: '2026-07-15T00:00:00.000Z',
    },
  ],
};

function response(overrides: Partial<AdminReviewQueueResponse> = {}): AdminReviewQueueResponse {
  return { total: 1, items: [item], page: 1, pageSize: 10, ...overrides };
}

function Location() {
  const location = useLocation();
  return <output data-testid="location">{location.search}</output>;
}

function renderPage(initialEntry = '/admin/reviews?queue=reported&sort=oldest') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <AdminReviewModerationPage />
      <Location />
    </MemoryRouter>,
  );
}

function deferred<T>() {
  let resolve: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve: resolve! };
}

describe('AdminReviewModerationPage', () => {
  afterEach(() => vi.resetAllMocks());

  it('uses URL-backed queue state and renders report detail as text', async () => {
    api.getAdminReviewQueue.mockResolvedValue(response());
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('Impossible Powder')).toBeInTheDocument();
    expect(screen.getByText('<b>Inert report detail</b>')).toBeInTheDocument();
    expect(screen.queryByRole('strong')).not.toBeInTheDocument();
    expect(api.getAdminReviewQueue).toHaveBeenCalledWith(
      { queue: 'reported', sort: 'oldest', page: 1, pageSize: 10 },
      expect.any(AbortSignal),
    );

    await user.selectOptions(screen.getByLabelText('Queue'), 'hidden');

    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent('queue=hidden&sort=oldest'),
    );
    expect(api.getAdminReviewQueue).toHaveBeenLastCalledWith(
      { queue: 'hidden', sort: 'oldest', page: 1, pageSize: 10 },
      expect.any(AbortSignal),
    );
  });

  it('shows empty and retryable error states', async () => {
    api.getAdminReviewQueue
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(response({ total: 0, items: [] }));
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('offline')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try Again' }));
    expect(await screen.findByText('No reported reviews')).toBeInTheDocument();
  });

  it('ignores a stale queue completion after URL state changes', async () => {
    const stale = deferred<AdminReviewQueueResponse>();
    api.getAdminReviewQueue
      .mockResolvedValueOnce(response())
      .mockImplementationOnce(() => stale.promise)
      .mockResolvedValueOnce(
        response({
          items: [{ ...item, productName: 'Current reported product' }],
        }),
      );
    const user = userEvent.setup();
    renderPage('/admin/reviews?queue=reported');

    await screen.findByText('Impossible Powder');
    await user.selectOptions(screen.getByLabelText('Queue'), 'hidden');
    await user.selectOptions(screen.getByLabelText('Queue'), 'reported');
    expect(await screen.findByText('Current reported product')).toBeInTheDocument();
    stale.resolve(response({ items: [{ ...item, productName: 'Stale hidden product' }] }));

    await waitFor(() => expect(screen.queryByText('Stale hidden product')).not.toBeInTheDocument());
    expect(screen.getByText('Current reported product')).toBeInTheDocument();
  });

  it('focuses the next queue card after moderation and keeps mutation failure actionable', async () => {
    const nextItem = { ...item, id: 'review-2', productName: 'Next reported product' };
    api.getAdminReviewQueue
      .mockResolvedValueOnce(response())
      .mockResolvedValueOnce(response({ items: [nextItem] }));
    api.moderateAdminReview.mockResolvedValue({
      reviewId: 'review-1',
      status: 'hidden',
      resolvedReportCount: 1,
      decision: 'hide_review',
    });
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Impossible Powder');
    await user.click(screen.getByRole('button', { name: 'Hide and action reports' }));
    expect(
      await screen.findByRole('article', { name: 'Review for Next reported product' }),
    ).toHaveFocus();
    expect(screen.getByText('Review hidden and reports actioned.')).toBeInTheDocument();
    expect(api.moderateAdminReview).toHaveBeenCalledWith('review-1', { decision: 'hide_review' });

    api.moderateAdminReview.mockRejectedValueOnce(new Error('Unable to save decision'));
    await user.click(screen.getByRole('button', { name: 'Dismiss reports' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to save decision');
    expect(screen.getByRole('button', { name: 'Dismiss reports' })).toBeEnabled();
  });

  it('focuses queue heading when moderation leaves no queue card', async () => {
    api.getAdminReviewQueue
      .mockResolvedValueOnce(response())
      .mockResolvedValueOnce(response({ total: 0, items: [] }));
    api.moderateAdminReview.mockResolvedValue({
      reviewId: 'review-1',
      status: 'hidden',
      resolvedReportCount: 1,
      decision: 'hide_review',
    });
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Impossible Powder');
    await user.click(screen.getByRole('button', { name: 'Hide and action reports' }));

    expect(await screen.findByText('No reported reviews')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Review moderation' })).toHaveFocus();
  });
});
