import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatMoney } from '@/lib/formatMoney';
import { pay } from '@/api/payments';
import { ApiError } from '@/api/client';
import { useCartContext } from '@/hooks/CartContext';

interface PaymentState {
  cartId: string;
  customerName: string;
  customerEmail: string;
  shippingAddress: string;
  promoCode: string | null;
  discountCents: number;
  subtotalCents: number;
}

interface CardForm {
  cardNumber: string;
  cardExpiry: string;
  cardCvc: string;
}

export function PaymentPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as PaymentState | null;
  const { clearCart } = useCartContext();

  const [cardForm, setCardForm] = useState<CardForm>({
    cardNumber: '',
    cardExpiry: '',
    cardCvc: '',
  });
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);

  // Guard: redirect to checkout if state is missing
  useEffect(() => {
    if (!state) {
      navigate('/checkout', { replace: true });
    }
  }, [state, navigate]);

  // Regenerate idempotency key when card inputs change
  const keyRegenerationDisabled = useRef(false);
  const handleCardChange = useCallback((field: keyof CardForm, value: string) => {
    setCardForm((prev) => ({ ...prev, [field]: value }));
    setError(null);
    if (!keyRegenerationDisabled.current) {
      setIdempotencyKey(crypto.randomUUID());
    }
  }, []);

  const totalCents =
    state && state.promoCode && state.discountCents > 0
      ? state.subtotalCents - state.discountCents
      : (state?.subtotalCents ?? 0);

  const handleSubmit = useCallback(async () => {
    if (!state || submitting) return;
    setSubmitting(true);
    setError(null);
    setConflictMessage(null);

    try {
      const order = await pay({
        cartId: state.cartId,
        promoCode: state.promoCode ?? undefined,
        customerName: state.customerName,
        customerEmail: state.customerEmail,
        shippingAddress: state.shippingAddress,
        cardNumber: cardForm.cardNumber,
        cardExpiry: cardForm.cardExpiry,
        cardCvc: cardForm.cardCvc,
        idempotencyKey,
      });
      clearCart();
      navigate(`/order-confirmation/${order.id}`, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 402) {
          const reason =
            (err.response as { failureReason?: string } | null)?.failureReason ?? 'Payment failed';
          setError(`Payment failed: ${reason}`);
          // Regenerate idempotency key after failure so retry is a new attempt
          setIdempotencyKey(crypto.randomUUID());
        } else if (err.status === 409) {
          setConflictMessage(
            'Payment already submitted with different data. Please review your details and try again.',
          );
          // Don't regenerate key on conflict — user must change inputs, which will regenerate
          keyRegenerationDisabled.current = true;
        } else if (err.status === 400) {
          setError(err.message);
        } else {
          setError(err.message);
        }
      } else {
        setError(err instanceof Error ? err.message : 'Payment failed');
      }
    } finally {
      setSubmitting(false);
      // Re-enable key regeneration for next input change
      keyRegenerationDisabled.current = false;
    }
  }, [state, submitting, cardForm, idempotencyKey, clearCart, navigate]);

  if (!state) return null;

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-2 text-2xl font-bold">Simulated payment</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Use a test card only. No charge is made and card details are not stored.
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left column: Shipping summary + Card form */}
        <div className="space-y-6">
          {/* Shipping & Contact Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Delivery and contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Name: </span>
                {state.customerName}
              </div>
              <div>
                <span className="text-muted-foreground">Email: </span>
                {state.customerEmail}
              </div>
              <div>
                <span className="text-muted-foreground">Address: </span>
                {state.shippingAddress}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => navigate('/checkout', { state })}
              >
                Edit Details
              </Button>
            </CardContent>
          </Card>

          {/* Card Payment Form */}
          <Card>
            <CardHeader>
              <CardTitle>Test card details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="cardNumber" className="text-sm font-medium">
                  Card Number
                </label>
                <Input
                  id="cardNumber"
                  value={cardForm.cardNumber}
                  onChange={(e) => handleCardChange('cardNumber', e.target.value)}
                  placeholder="4242 4242 4242 4242"
                  autoComplete="cc-number"
                  maxLength={25}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="cardExpiry" className="text-sm font-medium">
                    Expiry (MM/YY)
                  </label>
                  <Input
                    id="cardExpiry"
                    value={cardForm.cardExpiry}
                    onChange={(e) => handleCardChange('cardExpiry', e.target.value)}
                    placeholder="MM/YY"
                    autoComplete="cc-exp"
                    maxLength={5}
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="cardCvc" className="text-sm font-medium">
                    CVC
                  </label>
                  <Input
                    id="cardCvc"
                    value={cardForm.cardCvc}
                    onChange={(e) => handleCardChange('cardCvc', e.target.value)}
                    placeholder="123"
                    autoComplete="cc-csc"
                    maxLength={4}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column: Order Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Powder order summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatMoney(state.subtotalCents)}</span>
            </div>

            {state.promoCode && state.discountCents > 0 && (
              <div className="flex items-center justify-between text-sm text-green-700">
                <span>Discount ({state.promoCode})</span>
                <span>−{formatMoney(state.discountCents)}</span>
              </div>
            )}

            <Separator />

            <div className="flex items-center justify-between text-lg font-bold">
              <span>Total</span>
              <span>{formatMoney(totalCents)}</span>
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-md bg-destructive/5 p-3 text-sm text-destructive"
              >
                {error}
              </div>
            )}

            {conflictMessage && (
              <div role="alert" className="rounded-md border border-border bg-muted/60 p-3 text-sm">
                {conflictMessage}
              </div>
            )}

            <Button
              className="w-full"
              size="lg"
              disabled={submitting}
              onClick={() => {
                void handleSubmit();
              }}
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Processing simulated payment...
                </span>
              ) : (
                `Simulate payment of ${formatMoney(totalCents)}`
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
