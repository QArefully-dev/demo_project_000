import type { ReviewSummary as ReviewSummaryData } from '@shop/contracts/reviews';

interface ReviewSummaryProps {
  summary: ReviewSummaryData;
}

export function ReviewSummary({ summary }: ReviewSummaryProps) {
  if (summary.total === 0) return null;

  const maximum = Math.max(...summary.distribution.map(({ count }) => count), 1);
  return (
    <div className="rounded-lg border border-border p-4" aria-label="Review summary">
      <p className="text-2xl font-semibold">
        {summary.averageRating?.toFixed(1)}{' '}
        <span className="text-base" aria-hidden="true">
          ★
        </span>
      </p>
      <p className="text-sm text-muted-foreground">
        {summary.total} review{summary.total === 1 ? '' : 's'}
      </p>
      <ul className="mt-3 space-y-1" aria-label="Rating distribution">
        {[...summary.distribution]
          .sort((a, b) => b.rating - a.rating)
          .map(({ rating, count }) => (
            <li
              key={rating}
              className="flex items-center gap-2 text-sm"
              aria-label={`${rating} stars: ${count} reviews`}
            >
              <span className="w-12">{rating} stars</span>
              <span className="h-2 flex-1 overflow-hidden rounded bg-muted" aria-hidden="true">
                <span
                  className="block h-full bg-primary"
                  style={{ width: `${(count / maximum) * 100}%` }}
                />
              </span>
              <span className="w-8 text-right tabular-nums">{count}</span>
            </li>
          ))}
      </ul>
    </div>
  );
}
