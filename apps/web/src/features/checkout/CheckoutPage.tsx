import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ErrorMessage } from '@/components/ErrorMessage';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useCartContext } from '@/hooks/CartContext';
import { CheckoutSummary } from './CheckoutSummary';
import { ContactDetailsStep } from './ContactDetailsStep';
import { PaymentDetailsStep } from './PaymentDetailsStep';
import { useCheckoutFlow } from './useCheckoutFlow';

export function CheckoutPage() {
  const flow = useCheckoutFlow();
  const {
    isInitializing: isCartInitializing,
    isLoading: isCartLoading,
    error: cartError,
    retryCart,
    isCartAvailable,
  } = useCartContext();

  if (isCartInitializing || isCartLoading) return <LoadingSpinner />;
  if (!flow.cart) {
    return (
      <ErrorMessage
        message={cartError ?? 'Your cart is unavailable.'}
        onRetry={() => void retryCart()}
      />
    );
  }
  if (flow.cart.totalItems === 0) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 py-12 text-center">
        {flow.cartRecoveryMessage && (
          <p
            role="status"
            className="rounded-lg border border-border bg-muted/60 px-4 py-3 text-sm"
          >
            {flow.cartRecoveryMessage}
          </p>
        )}
        <p className="text-muted-foreground">Your order is empty</p>
        <Button render={<Link to="/catalog" />}>Browse materials</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-2 text-2xl font-bold">Confirm your order</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Payment is simulated for this demo. No real payment is collected and no goods are
        dispatched.
      </p>
      {cartError && (
        <div
          role="alert"
          className="mb-6 flex items-center justify-between gap-4 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3"
        >
          <p className="text-sm text-destructive">{cartError}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void retryCart()}>
            Retry cart
          </Button>
        </div>
      )}
      {flow.cartRecoveryMessage && (
        <p
          role="status"
          className="mb-6 rounded-lg border border-border bg-muted/60 px-4 py-3 text-sm text-foreground"
        >
          {flow.cartRecoveryMessage}
        </p>
      )}
      {flow.conflict?.code === 'INSUFFICIENT_STOCK' && (
        <div
          role="alert"
          className="mb-6 space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"
        >
          <p>One or more items are no longer available in the requested quantity.</p>
          <p className="text-muted-foreground">
            Your cart has not been changed. Refresh it, then review quantities before retrying.
          </p>
          <Button type="button" variant="outline" size="sm" onClick={() => void retryCart()}>
            Refresh cart
          </Button>
        </div>
      )}
      {flow.conflict?.code === 'RESERVATION_EXPIRED' && (
        <div
          role="alert"
          className="mb-6 space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"
        >
          <p>Your checkout reservation expired before payment could complete.</p>
          <p className="text-muted-foreground">
            Your cart has not been changed. Refresh it before starting a new payment attempt.
          </p>
          <Button type="button" variant="outline" size="sm" onClick={() => void retryCart()}>
            Refresh cart
          </Button>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="pt-6">
            {flow.step === 'contact' ? (
              <ContactDetailsStep
                contact={flow.contact}
                fieldError={flow.fieldError}
                onChange={flow.updateContact}
                onBlur={flow.touchField}
                onContinue={flow.goToPayment}
                disabled={flow.promoValidating || !isCartAvailable}
              />
            ) : (
              <PaymentDetailsStep
                card={flow.card}
                fieldError={flow.fieldError}
                onChange={flow.updateCard}
                onBlur={flow.touchField}
                onBack={flow.goToContact}
                onSubmit={() => void flow.submitPayment()}
                submitting={flow.submitting}
                disabled={flow.submitting || !isCartAvailable}
              />
            )}
            {flow.paymentError && (
              <p
                role="alert"
                className="mt-4 rounded-md bg-destructive/5 p-3 text-sm text-destructive"
              >
                {flow.paymentError}
              </p>
            )}
          </CardContent>
        </Card>
        <CheckoutSummary
          cart={flow.cart}
          promoCode={flow.promoCode}
          appliedPromo={flow.appliedPromo}
          discountCents={flow.discountCents}
          totalCents={flow.totalCents}
          promoError={flow.promoError}
          promoValidating={flow.promoValidating}
          isPromoEligible={flow.isPromoEligible}
          onPromoChange={flow.updatePromoCode}
          onApplyPromo={() => void flow.applyPromo()}
          onRemovePromo={flow.removePromo}
        />
      </div>
    </div>
  );
}
