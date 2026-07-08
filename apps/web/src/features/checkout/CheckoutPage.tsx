import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorMessage } from '@/components/ErrorMessage';
import { formatMoney } from '@/lib/formatMoney';
import { useCheckout } from '@/hooks/useCheckout';
import { useCartContext } from '@/hooks/CartContext';

export function CheckoutPage() {
  const {
    cart,
    form,
    updateField,
    blurField,
    getFieldError,
    promoCode,
    setPromoCode,
    appliedPromo,
    discountCents,
    promoError,
    promoValidating,
    isPromoEligible,
    totalCents,
    validatePromo,
    removePromo,
    submitOrder,
    submitting,
    submitError,
    cartRecoveryMessage,
  } = useCheckout();
  const {
    isInitializing: isCartInitializing,
    isLoading: isCartLoading,
    error: cartError,
    retryCart,
    isCartAvailable,
  } = useCartContext();

  if (isCartInitializing || isCartLoading) return <LoadingSpinner />;
  if (!cart) {
    return (
      <ErrorMessage
        message={cartError ?? 'Your cart is unavailable.'}
        onRetry={() => void retryCart()}
      />
    );
  }
  if (cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl py-12 text-center space-y-4">
        {cartRecoveryMessage && (
          <p
            role="status"
            className="rounded-lg border border-border bg-muted/60 px-4 py-3 text-sm"
          >
            {cartRecoveryMessage}
          </p>
        )}
        <p className="text-muted-foreground">Your cart is empty</p>
        <Button render={<Link to="/" />}>Continue Shopping</Button>
      </div>
    );
  }

  const customerNameError = getFieldError('customerName');
  const customerEmailError = getFieldError('customerEmail');
  const shippingAddressError = getFieldError('shippingAddress');

  return (
    <form
      className="mx-auto max-w-5xl"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void submitOrder();
      }}
    >
      <h1 className="mb-6 text-2xl font-bold">Checkout</h1>
      {cartError && (
        <div
          role="alert"
          className="mb-6 flex items-center justify-between gap-4 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3"
        >
          <p className="text-sm text-destructive">{cartError}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void retryCart()}>
            Retry Cart
          </Button>
        </div>
      )}
      {cartRecoveryMessage && (
        <p
          role="status"
          className="mb-6 rounded-lg border border-border bg-muted/60 px-4 py-3 text-sm text-foreground"
        >
          {cartRecoveryMessage}
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Customer & Shipping</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="customerName" className="text-sm font-medium">
                Full Name
              </label>
              <Input
                id="customerName"
                value={form.customerName}
                onChange={(e) => updateField('customerName', e.target.value)}
                onBlur={() => blurField('customerName')}
                autoComplete="name"
                aria-invalid={Boolean(customerNameError)}
                aria-describedby={customerNameError ? 'customerName-error' : undefined}
              />
              {customerNameError && (
                <p id="customerName-error" role="alert" className="text-xs text-destructive">
                  {customerNameError}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <label htmlFor="customerEmail" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="customerEmail"
                type="email"
                value={form.customerEmail}
                onChange={(e) => updateField('customerEmail', e.target.value)}
                onBlur={() => blurField('customerEmail')}
                autoComplete="email"
                aria-invalid={Boolean(customerEmailError)}
                aria-describedby={customerEmailError ? 'customerEmail-error' : undefined}
              />
              {customerEmailError && (
                <p id="customerEmail-error" role="alert" className="text-xs text-destructive">
                  {customerEmailError}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <label htmlFor="shippingAddress" className="text-sm font-medium">
                Shipping Address
              </label>
              <Input
                id="shippingAddress"
                value={form.shippingAddress}
                onChange={(e) => updateField('shippingAddress', e.target.value)}
                onBlur={() => blurField('shippingAddress')}
                autoComplete="street-address"
                aria-invalid={Boolean(shippingAddressError)}
                aria-describedby={shippingAddressError ? 'shippingAddress-error' : undefined}
              />
              {shippingAddressError && (
                <p id="shippingAddress-error" role="alert" className="text-xs text-destructive">
                  {shippingAddressError}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Order Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {cart.items.map((item) => (
                <div key={item.productId} className="flex items-center justify-between text-sm">
                  <span>
                    {item.product.name}{' '}
                    <span className="text-muted-foreground">× {item.quantity}</span>
                  </span>
                  <span>{formatMoney(item.lineTotalCents)}</span>
                </div>
              ))}
            </div>
            <Separator />

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatMoney(cart.subtotalCents)}</span>
            </div>

            <div className="space-y-2">
              <label htmlFor="promoCode" className="text-sm font-medium">
                Promo Code
              </label>
              {!appliedPromo ? (
                <div className="flex gap-2">
                  <Input
                    id="promoCode"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    placeholder={isPromoEligible ? 'Promo code' : 'Add 5+ items to unlock promo'}
                    disabled={!isPromoEligible}
                    className="flex-1"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void validatePromo();
                      }
                    }}
                    aria-describedby={promoError ? 'promo-error' : undefined}
                    aria-invalid={Boolean(promoError)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!isPromoEligible || !promoCode.trim() || promoValidating}
                    onClick={() => {
                      void validatePromo();
                    }}
                  >
                    {promoValidating ? 'Checking...' : 'Apply'}
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2">
                  <span className="text-sm font-medium text-green-700">{appliedPromo} applied</span>
                  <Button type="button" variant="ghost" size="sm" onClick={removePromo}>
                    Remove
                  </Button>
                </div>
              )}
              {promoError && (
                <p id="promo-error" role="alert" className="text-xs text-destructive">
                  {promoError}
                </p>
              )}
            </div>

            {discountCents > 0 && (
              <div className="flex items-center justify-between text-sm text-green-700">
                <span>Discount</span>
                <span>−{formatMoney(discountCents)}</span>
              </div>
            )}

            <Separator />

            <div className="flex items-center justify-between text-lg font-bold">
              <span>Total</span>
              <span>{formatMoney(totalCents)}</span>
            </div>

            {submitError && (
              <p role="alert" className="rounded-md bg-destructive/5 p-3 text-sm text-destructive">
                {submitError}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 flex justify-end">
        <Button
          type="submit"
          size="lg"
          disabled={submitting || promoValidating || !isCartAvailable}
        >
          {submitting ? 'Placing Order...' : 'Place Order'}
        </Button>
      </div>
    </form>
  );
}
