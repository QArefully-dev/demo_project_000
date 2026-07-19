import { useEffect, useState, type FormEvent } from 'react';
import type { CreateReviewBody, OwnedReview } from '@shop/contracts/reviews';
import { Button } from '@/components/ui/button';

interface ReviewFormProps {
  review: OwnedReview | null;
  isPending: boolean;
  error: string | null;
  onSubmit: (body: CreateReviewBody) => Promise<boolean>;
  onDelete: () => Promise<boolean>;
}

const MIN_BODY_LENGTH = 20;
const MAX_BODY_LENGTH = 4000;

export function ReviewForm({ review, isPending, error, onSubmit, onDelete }: ReviewFormProps) {
  const [rating, setRating] = useState(review?.rating ?? 5);
  const [body, setBody] = useState(review?.body ?? '');
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    setRating(review?.rating ?? 5);
    setBody(review?.body ?? '');
    setValidationError(null);
  }, [review?.id]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = body.trim();
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      setValidationError('Choose a rating from 1 to 5.');
      return;
    }
    if (trimmed.length < MIN_BODY_LENGTH || trimmed.length > MAX_BODY_LENGTH) {
      setValidationError(
        `Review text must be ${MIN_BODY_LENGTH} to ${MAX_BODY_LENGTH} characters.`,
      );
      return;
    }
    setValidationError(null);
    const saved = await onSubmit({ rating, body: trimmed });
    if (saved && !review) setBody('');
  }

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      className="space-y-4 rounded-lg border border-border p-4"
      aria-label={review ? 'Edit your review' : 'Write a review'}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold">{review ? 'Your review' : 'Write a review'}</h3>
        {review?.status === 'hidden' && (
          <span className="text-sm text-muted-foreground">Hidden by moderation</span>
        )}
      </div>
      <fieldset disabled={isPending}>
        <legend className="text-sm font-medium">Rating</legend>
        <div className="mt-1 flex gap-2">
          {[1, 2, 3, 4, 5].map((value) => (
            <label key={value} className="cursor-pointer text-sm">
              <input
                type="radio"
                name="review-rating"
                value={value}
                checked={rating === value}
                onChange={() => setRating(value)}
                className="peer sr-only"
              />
              <span className="rounded border border-border px-2 py-1 peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground">
                {value}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor="review-body" className="text-sm font-medium">
          Review
        </label>
        <textarea
          id="review-body"
          value={body}
          disabled={isPending}
          minLength={MIN_BODY_LENGTH}
          maxLength={MAX_BODY_LENGTH}
          onChange={(event) => setBody(event.target.value)}
          className="mt-1 min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          aria-describedby="review-body-help"
        />
        <p id="review-body-help" className="mt-1 text-xs text-muted-foreground">
          {body.trim().length}/{MAX_BODY_LENGTH} characters; at least {MIN_BODY_LENGTH} required.
        </p>
      </div>
      {(validationError || error) && (
        <p role="alert" className="text-sm text-destructive">
          {validationError ?? error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving…' : review ? 'Update review' : 'Publish review'}
        </Button>
        {review && (
          <Button
            type="button"
            variant="destructive"
            disabled={isPending}
            onClick={() => void onDelete()}
          >
            {isPending ? 'Saving…' : 'Delete review'}
          </Button>
        )}
      </div>
    </form>
  );
}
