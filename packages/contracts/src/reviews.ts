import { Type, type Static } from '@sinclair/typebox';
import { PositiveIntegerString } from './common.js';

const UtcIsoInstant = Type.String({
  minLength: 24,
  maxLength: 24,
  pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$',
});

const ReviewBody = Type.String({ minLength: 20, maxLength: 4000 });
const ReviewRating = Type.Integer({ minimum: 1, maximum: 5 });

export const ReviewStatus = Type.Union([Type.Literal('published'), Type.Literal('hidden')]);
export type ReviewStatus = Static<typeof ReviewStatus>;

export const ReviewSort = Type.Union([
  Type.Literal('newest'),
  Type.Literal('oldest'),
  Type.Literal('highest'),
  Type.Literal('lowest'),
]);
export type ReviewSort = Static<typeof ReviewSort>;

export const ReviewAuthor = Type.Object(
  { displayName: Type.String({ minLength: 1, maxLength: 120 }) },
  { additionalProperties: false },
);
export type ReviewAuthor = Static<typeof ReviewAuthor>;

/** Public, published review. Moderation state is deliberately not exposed. */
export const Review = Type.Object(
  {
    id: PositiveIntegerString,
    productId: PositiveIntegerString,
    author: ReviewAuthor,
    rating: ReviewRating,
    body: ReviewBody,
    verifiedPurchase: Type.Boolean(),
    createdAt: UtcIsoInstant,
    updatedAt: UtcIsoInstant,
  },
  { additionalProperties: false },
);
export type Review = Static<typeof Review>;

/** An authenticated review owner's record, including its moderation status. */
export const OwnedReview = Type.Object(
  { ...Review.properties, status: ReviewStatus },
  { additionalProperties: false },
);
export type OwnedReview = Static<typeof OwnedReview>;

const ReviewStarCountFor = (rating: 1 | 2 | 3 | 4 | 5) =>
  Type.Object(
    { rating: Type.Literal(rating), count: Type.Integer({ minimum: 0 }) },
    { additionalProperties: false },
  );

export const ReviewStarCount = Type.Union([
  ReviewStarCountFor(1),
  ReviewStarCountFor(2),
  ReviewStarCountFor(3),
  ReviewStarCountFor(4),
  ReviewStarCountFor(5),
]);
export type ReviewStarCount = Static<typeof ReviewStarCount>;

export const ReviewSummary = Type.Object(
  {
    total: Type.Integer({ minimum: 0 }),
    averageRating: Type.Union([Type.Number({ minimum: 1, maximum: 5 }), Type.Null()]),
    distribution: Type.Tuple([
      ReviewStarCountFor(1),
      ReviewStarCountFor(2),
      ReviewStarCountFor(3),
      ReviewStarCountFor(4),
      ReviewStarCountFor(5),
    ]),
  },
  { additionalProperties: false },
);
export type ReviewSummary = Static<typeof ReviewSummary>;

export const ReviewListQuery = Type.Object(
  {
    sort: Type.Optional(ReviewSort),
    page: Type.Optional(Type.Integer({ minimum: 1, maximum: 10_000 })),
    pageSize: Type.Optional(Type.Integer({ minimum: 1, maximum: 50 })),
  },
  { additionalProperties: false },
);
export type ReviewListQuery = Static<typeof ReviewListQuery>;

export const ReviewListResponse = Type.Object(
  {
    summary: ReviewSummary,
    items: Type.Array(Review),
    page: Type.Integer({ minimum: 1, maximum: 10_000 }),
    pageSize: Type.Integer({ minimum: 1, maximum: 50 }),
  },
  { additionalProperties: false },
);
export type ReviewListResponse = Static<typeof ReviewListResponse>;

export const ReviewProductParam = Type.Object(
  { productId: PositiveIntegerString },
  { additionalProperties: false },
);
export type ReviewProductParam = Static<typeof ReviewProductParam>;

export const ReviewIdParam = Type.Object(
  { reviewId: PositiveIntegerString },
  { additionalProperties: false },
);
export type ReviewIdParam = Static<typeof ReviewIdParam>;

/** Customer write payload. Server-derived and ownership fields are excluded. */
export const CreateReviewBody = Type.Object(
  { rating: ReviewRating, body: ReviewBody },
  { additionalProperties: false },
);
export type CreateReviewBody = Static<typeof CreateReviewBody>;

export const UpdateReviewBody = Type.Object(
  { rating: ReviewRating, body: ReviewBody },
  { additionalProperties: false },
);
export type UpdateReviewBody = Static<typeof UpdateReviewBody>;

/** Successful customer or admin review mutation result. */
export const ReviewMutationResponse = OwnedReview;
export type ReviewMutationResponse = Static<typeof ReviewMutationResponse>;

/** Authenticated owner's review for a product, or null when none exists. */
export const OwnedReviewResponse = Type.Union([OwnedReview, Type.Null()]);
export type OwnedReviewResponse = Static<typeof OwnedReviewResponse>;
