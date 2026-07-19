import type { Review } from '@shop/contracts/reviews';

interface ReviewListProps {
  reviews: Review[];
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleDateString();
}

export function ReviewList({ reviews }: ReviewListProps) {
  if (reviews.length === 0) {
    return <p className="text-sm text-muted-foreground">No published reviews yet.</p>;
  }

  return (
    <ol className="divide-y divide-border" aria-label="Customer reviews">
      {reviews.map((review) => (
        <li key={review.id} className="py-5 first:pt-0">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p className="font-medium">{review.author.displayName}</p>
            <time className="text-sm text-muted-foreground" dateTime={review.createdAt}>
              {formatDate(review.createdAt)}
            </time>
          </div>
          <p className="mt-1" aria-label={`${review.rating} out of 5 stars`}>
            <span aria-hidden="true">
              {'★'.repeat(review.rating)}
              {'☆'.repeat(5 - review.rating)}
            </span>
          </p>
          {review.verifiedPurchase && (
            <p className="mt-1 text-sm font-medium text-primary" aria-label="Verified purchase">
              Verified purchase
            </p>
          )}
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{review.body}</p>
        </li>
      ))}
    </ol>
  );
}
