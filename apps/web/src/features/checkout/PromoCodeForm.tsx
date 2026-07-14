import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface PromoCodeFormProps {
  promoCode: string;
  appliedPromo: string | null;
  error: string | null;
  validating: boolean;
  eligible: boolean;
  onChange: (value: string) => void;
  onApply: () => void;
  onRemove: () => void;
}

export function PromoCodeForm({
  promoCode,
  appliedPromo,
  error,
  validating,
  eligible,
  onChange,
  onApply,
  onRemove,
}: PromoCodeFormProps) {
  return (
    <div className="space-y-2">
      <label htmlFor="promoCode" className="text-sm font-medium">
        Powder promotion
      </label>
      <p className="text-xs text-muted-foreground">
        SAVE10 takes 10% off when this cart contains at least five bags.
      </p>
      {!appliedPromo ? (
        <div className="flex gap-2">
          <Input
            id="promoCode"
            value={promoCode}
            onChange={(event) => onChange(event.target.value)}
            placeholder={eligible ? 'Enter SAVE10' : 'Add 5 bags to unlock SAVE10'}
            disabled={!eligible}
            className="flex-1"
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                onApply();
              }
            }}
            aria-describedby={error ? 'promo-error' : undefined}
            aria-invalid={Boolean(error)}
          />
          <Button
            type="button"
            variant="outline"
            disabled={!eligible || !promoCode.trim() || validating}
            onClick={onApply}
          >
            {validating ? 'Checking...' : 'Apply'}
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2">
          <span className="text-sm font-medium text-green-700">{appliedPromo} applied</span>
          <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
            Remove
          </Button>
        </div>
      )}
      {error && (
        <p id="promo-error" role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
