import { useCallback, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export function useCheckoutNavigation(contactIsValid: boolean) {
  const navigate = useNavigate();
  const location = useLocation();
  const paymentRequested = new URLSearchParams(location.search).get('step') === 'payment';

  useEffect(() => {
    if (paymentRequested && !contactIsValid) navigate('/checkout', { replace: true });
  }, [contactIsValid, navigate, paymentRequested]);

  return {
    step: paymentRequested ? 'payment' : ('contact' as const),
    goToPayment: useCallback(() => navigate('/checkout?step=payment'), [navigate]),
    goToContact: useCallback(() => navigate('/checkout'), [navigate]),
    replaceWithOrder: useCallback(
      (orderId: string) => navigate(`/order-confirmation/${orderId}`, { replace: true }),
      [navigate],
    ),
  };
}
