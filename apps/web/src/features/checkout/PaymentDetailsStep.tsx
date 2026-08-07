import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLocalisation } from '@/i18n/LocaleContext';
import { checkoutMessages } from '@shop/localisation/messages/checkout';
import { translateValidationError } from './checkoutCopy';

type CardField = 'cardNumber' | 'cardExpiry' | 'cardCvc';

interface PaymentDetailsStepProps {
  card: Record<CardField, string>;
  fieldError: (field: CardField) => string | undefined;
  onChange: (field: CardField, value: string) => void;
  onBlur: (field: CardField) => void;
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
  disabled: boolean;
}
export function PaymentDetailsStep({
  card,
  fieldError,
  onChange,
  onBlur,
  onBack,
  onSubmit,
  submitting,
  disabled,
}: PaymentDetailsStepProps) {
  const { translate } = useLocalisation();
  const t = (key: keyof typeof checkoutMessages, params?: Record<string, string | number>) =>
    translate(checkoutMessages, key, params);
  const errorFor = (field: CardField) => {
    const error = fieldError(field);
    return error ? translateValidationError(error, t) : undefined;
  };
  const cardNumberError = errorFor('cardNumber');
  const cardExpiryError = errorFor('cardExpiry');
  const cardCvcError = errorFor('cardCvc');

  return (
    <section aria-labelledby="payment-step-title" className="space-y-4">
      <div>
        <h2 id="payment-step-title" className="text-lg font-semibold">
          {t('checkout.step.payment')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('checkout.cardPageOnly')}</p>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="cardNumber" className="text-sm font-medium">
          {t('checkout.cardNumber')}
        </label>
        <Input
          id="cardNumber"
          value={card.cardNumber}
          onChange={(event) => onChange('cardNumber', event.target.value)}
          onBlur={() => onBlur('cardNumber')}
          placeholder="4242 4242 4242 4242"
          autoComplete="cc-number"
          maxLength={25}
          aria-invalid={Boolean(cardNumberError)}
          aria-describedby={cardNumberError ? 'cardNumber-error' : undefined}
        />
        {cardNumberError && (
          <p id="cardNumber-error" role="alert" className="text-xs text-destructive">
            {cardNumberError}
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label htmlFor="cardExpiry" className="text-sm font-medium">
            {t('checkout.expiry')}
          </label>
          <Input
            id="cardExpiry"
            value={card.cardExpiry}
            onChange={(event) => onChange('cardExpiry', event.target.value)}
            onBlur={() => onBlur('cardExpiry')}
            placeholder="MM/YY"
            autoComplete="cc-exp"
            maxLength={5}
            aria-invalid={Boolean(cardExpiryError)}
            aria-describedby={cardExpiryError ? 'cardExpiry-error' : undefined}
          />
          {cardExpiryError && (
            <p id="cardExpiry-error" role="alert" className="text-xs text-destructive">
              {cardExpiryError}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <label htmlFor="cardCvc" className="text-sm font-medium">
            {t('checkout.cvc')}
          </label>
          <Input
            id="cardCvc"
            value={card.cardCvc}
            onChange={(event) => onChange('cardCvc', event.target.value)}
            onBlur={() => onBlur('cardCvc')}
            placeholder="123"
            autoComplete="cc-csc"
            maxLength={4}
            aria-invalid={Boolean(cardCvcError)}
            aria-describedby={cardCvcError ? 'cardCvc-error' : undefined}
          />
          {cardCvcError && (
            <p id="cardCvc-error" role="alert" className="text-xs text-destructive">
              {cardCvcError}
            </p>
          )}
        </div>
      </div>
      <div className="flex gap-3">
        <Button type="button" variant="outline" className="flex-1" onClick={onBack}>
          {t('checkout.backSchedule')}
        </Button>
        <Button type="button" className="flex-1" disabled={disabled} onClick={onSubmit}>
          {submitting ? t('checkout.processingPayment') : t('checkout.simulatePayment')}
        </Button>
      </div>
    </section>
  );
}
