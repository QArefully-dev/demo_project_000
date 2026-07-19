import type {
  OwnedReview,
  Review,
  ReviewListResponse,
  ReviewSummary,
} from '@shop/contracts/reviews';
import type { UnitOfWork } from '../../db/unitOfWork.js';
import type { AuditContext } from '../audit/auditEvent.js';
import type { AuditWriter, Clock } from '../audit/auditService.js';
import {
  normalizeReviewListQuery,
  normalizeReviewWrite,
  ReviewRuleError,
  type ReviewListQueryInput,
  type ReviewWriteInput,
} from './reviewRules.js';
import type { PersistedReviewStatus, ReviewRecord, ReviewRepository } from './reviewRepository.js';

export class ReviewServiceError extends Error {
  constructor(
    public readonly code:
      'NOT_FOUND' | 'FORBIDDEN' | 'DUPLICATE' | 'INVALID_TRANSITION' | 'INVALID_INPUT',
    message: string,
  ) {
    super(message);
    this.name = 'ReviewServiceError';
  }
}

export interface ReviewServiceDependencies {
  repository: ReviewRepository;
  unitOfWork: UnitOfWork;
  audit: AuditWriter;
  clock: Clock;
}

export interface ReviewService {
  listProduct(productId: number, query: ReviewListQueryInput): ReviewListResponse;
  findOwned(userId: number, productId: number): OwnedReview | null;
  create(
    userId: number,
    productId: number,
    input: ReviewWriteInput,
    context: AuditContext,
  ): OwnedReview;
  update(
    userId: number,
    reviewId: number,
    input: ReviewWriteInput,
    context: AuditContext,
  ): OwnedReview;
  delete(userId: number, reviewId: number, context: AuditContext): void;
  hide(reviewId: number, context: AuditContext): OwnedReview;
  restore(reviewId: number, context: AuditContext): OwnedReview;
}

function asReview(record: ReviewRecord): Review {
  return {
    id: String(record.id),
    productId: String(record.productId),
    author: { displayName: record.authorDisplayName },
    rating: record.rating,
    body: record.body,
    verifiedPurchase: record.verifiedPurchase,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function asOwnedReview(record: ReviewRecord): OwnedReview {
  return { ...asReview(record), status: record.status };
}

function asSummary(
  total: number,
  averageRating: number | null,
  stars: Readonly<Record<1 | 2 | 3 | 4 | 5, number>>,
): ReviewSummary {
  return {
    total,
    averageRating:
      averageRating === null ? null : Math.round((averageRating + Number.EPSILON) * 10) / 10,
    distribution: [
      { rating: 1, count: stars[1] },
      { rating: 2, count: stars[2] },
      { rating: 3, count: stars[3] },
      { rating: 4, count: stars[4] },
      { rating: 5, count: stars[5] },
    ],
  };
}

function now(clock: Clock): string {
  return clock.now().toISOString();
}

function normalizeWrite(input: ReviewWriteInput) {
  try {
    return normalizeReviewWrite(input);
  } catch (error) {
    if (error instanceof ReviewRuleError)
      throw new ReviewServiceError('INVALID_INPUT', error.message);
    throw error;
  }
}

function normalizeList(input: ReviewListQueryInput) {
  try {
    return normalizeReviewListQuery(input);
  } catch (error) {
    if (error instanceof ReviewRuleError)
      throw new ReviewServiceError('INVALID_INPUT', error.message);
    throw error;
  }
}

function requireOwner(
  repository: ReviewRepository,
  reviewId: number,
  userId: number,
): ReviewRecord {
  const review = repository.findById(reviewId);
  if (!review) throw new ReviewServiceError('NOT_FOUND', 'Review not found');
  if (review.userId !== userId)
    throw new ReviewServiceError('FORBIDDEN', 'Review is owned by another user');
  return review;
}

function requireReview(repository: ReviewRepository, reviewId: number): ReviewRecord {
  const review = repository.findById(reviewId);
  if (!review) throw new ReviewServiceError('NOT_FOUND', 'Review not found');
  return review;
}

function isUniqueConstraint(error: unknown): boolean {
  return (
    error instanceof Error &&
    /UNIQUE constraint failed: reviews\.user_id, reviews\.product_id/.test(error.message)
  );
}

/** Coordinates rules, ownership and audit writes; repository mutations remain transaction-neutral. */
export function createReviewService(dependencies: ReviewServiceDependencies): ReviewService {
  const { repository, unitOfWork, audit, clock } = dependencies;
  return {
    listProduct(productId, input) {
      const query = normalizeList(input);
      return unitOfWork.run(() => {
        if (!repository.activeProductExists(productId))
          throw new ReviewServiceError('NOT_FOUND', 'Product not found');
        const summary = repository.summaryPublished(productId);
        const items = repository.listPublished(productId, query.sort, query.page, query.pageSize);
        return {
          summary: asSummary(summary.total, summary.averageRating, summary.starCounts),
          items: items.map(asReview),
          page: query.page,
          pageSize: query.pageSize,
        };
      });
    },
    findOwned(userId, productId) {
      if (!repository.activeProductExists(productId))
        throw new ReviewServiceError('NOT_FOUND', 'Product not found');
      const review = repository.findOwnedByProduct(userId, productId);
      return review ? asOwnedReview(review) : null;
    },
    create(userId, productId, input, context) {
      const normalized = normalizeWrite(input);
      try {
        return unitOfWork.run(() => {
          if (!repository.activeProductExists(productId))
            throw new ReviewServiceError('NOT_FOUND', 'Product not found');
          const review = repository.create({ productId, userId, ...normalized, now: now(clock) });
          audit.append({
            action: 'review.created',
            context,
            reviewId: review.id,
            productId,
            rating: review.rating,
          });
          return asOwnedReview(review);
        });
      } catch (error) {
        if (isUniqueConstraint(error))
          throw new ReviewServiceError('DUPLICATE', 'A review already exists for this product');
        throw error;
      }
    },
    update(userId, reviewId, input, context) {
      const normalized = normalizeWrite(input);
      return unitOfWork.run(() => {
        const existing = requireOwner(repository, reviewId, userId);
        const review = repository.update(reviewId, userId, { ...normalized, now: now(clock) });
        if (!review) throw new ReviewServiceError('FORBIDDEN', 'Review is owned by another user');
        audit.append({
          action: 'review.updated',
          context,
          reviewId,
          productId: existing.productId,
          rating: review.rating,
        });
        return asOwnedReview(review);
      });
    },
    delete(userId, reviewId, context) {
      unitOfWork.run(() => {
        const review = requireOwner(repository, reviewId, userId);
        if (!repository.delete(reviewId, userId))
          throw new ReviewServiceError('FORBIDDEN', 'Review is owned by another user');
        audit.append({ action: 'review.deleted', context, reviewId, productId: review.productId });
      });
    },
    hide(reviewId, context) {
      return transition(
        repository,
        unitOfWork,
        audit,
        clock,
        reviewId,
        'published',
        'hidden',
        'review.hidden',
        context,
      );
    },
    restore(reviewId, context) {
      return transition(
        repository,
        unitOfWork,
        audit,
        clock,
        reviewId,
        'hidden',
        'published',
        'review.restored',
        context,
      );
    },
  };
}

function transition(
  repository: ReviewRepository,
  unitOfWork: UnitOfWork,
  audit: AuditWriter,
  clock: Clock,
  reviewId: number,
  from: PersistedReviewStatus,
  to: PersistedReviewStatus,
  action: 'review.hidden' | 'review.restored',
  context: AuditContext,
): OwnedReview {
  return unitOfWork.run(() => {
    const existing = requireReview(repository, reviewId);
    if (existing.status !== from)
      throw new ReviewServiceError('INVALID_TRANSITION', `Review is already ${existing.status}`);
    const review = repository.transitionStatus(reviewId, from, to, now(clock));
    if (!review) throw new ReviewServiceError('INVALID_TRANSITION', `Review is already ${to}`);
    audit.append({ action, context, reviewId, productId: review.productId });
    return asOwnedReview(review);
  });
}
