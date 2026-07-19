export const REVIEW_BODY_MIN_LENGTH = 20;
export const REVIEW_BODY_MAX_LENGTH = 4_000;
export const REVIEW_PAGE_DEFAULT = 1;
export const REVIEW_PAGE_SIZE_DEFAULT = 10;
export const REVIEW_PAGE_SIZE_MAX = 50;
export const REVIEW_SORTS = ['newest', 'oldest', 'highest', 'lowest'] as const;

export type ReviewSort = (typeof REVIEW_SORTS)[number];

export interface ReviewWriteInput {
  rating: unknown;
  body: unknown;
}

export interface NormalizedReviewWrite {
  rating: number;
  body: string;
}

export interface ReviewListQueryInput {
  sort?: unknown;
  page?: unknown;
  pageSize?: unknown;
}

export interface NormalizedReviewListQuery {
  sort: ReviewSort;
  page: number;
  pageSize: number;
}

export class ReviewRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReviewRuleError';
  }
}

function unicodeCharacterCount(value: string): number {
  return Array.from(value).length;
}

function normalizeBoundedPositiveInteger(
  value: unknown,
  field: 'page' | 'pageSize',
  fallback: number,
  maximum: number,
): number {
  const normalized = value ?? fallback;
  if (
    typeof normalized !== 'number' ||
    !Number.isSafeInteger(normalized) ||
    normalized < 1 ||
    normalized > maximum
  ) {
    throw new ReviewRuleError(`${field} must be an integer between 1 and ${maximum}`);
  }
  return normalized;
}

/** Trims and validates the only customer-controlled review fields before persistence. */
export function normalizeReviewWrite(input: ReviewWriteInput): NormalizedReviewWrite {
  if (
    typeof input.rating !== 'number' ||
    !Number.isSafeInteger(input.rating) ||
    input.rating < 1 ||
    input.rating > 5
  ) {
    throw new ReviewRuleError('rating must be an integer between 1 and 5');
  }
  if (typeof input.body !== 'string') {
    throw new ReviewRuleError('body must be text');
  }

  const body = input.body.trim();
  const characterCount = unicodeCharacterCount(body);
  if (characterCount < REVIEW_BODY_MIN_LENGTH || characterCount > REVIEW_BODY_MAX_LENGTH) {
    throw new ReviewRuleError(
      `body must be between ${REVIEW_BODY_MIN_LENGTH} and ${REVIEW_BODY_MAX_LENGTH} characters`,
    );
  }

  return { rating: input.rating, body };
}

/** Applies the fixed public-review sort allowlist and bounded pagination defaults. */
export function normalizeReviewListQuery(query: ReviewListQueryInput): NormalizedReviewListQuery {
  const sort = query.sort ?? 'newest';
  if (typeof sort !== 'string' || !REVIEW_SORTS.includes(sort as ReviewSort)) {
    throw new ReviewRuleError('sort must be one of newest, oldest, highest, or lowest');
  }

  return {
    sort: sort as ReviewSort,
    page: normalizeBoundedPositiveInteger(query.page, 'page', REVIEW_PAGE_DEFAULT, 10_000),
    pageSize: normalizeBoundedPositiveInteger(
      query.pageSize,
      'pageSize',
      REVIEW_PAGE_SIZE_DEFAULT,
      REVIEW_PAGE_SIZE_MAX,
    ),
  };
}
