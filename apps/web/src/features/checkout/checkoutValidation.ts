import type { CheckoutState, FieldErrors } from './checkoutState';

export function validateContact(contact: CheckoutState['contact']): FieldErrors {
  const errors: FieldErrors = {};
  if (!contact.customerName.trim()) errors.customerName = 'Name is required';
  if (!contact.customerEmail.trim()) errors.customerEmail = 'Email is required';
  else if (!/^[^\s@]+@[^\s@]+$/.test(contact.customerEmail.trim()))
    errors.customerEmail = 'Enter a valid email';
  if (!contact.shippingAddress.trim()) errors.shippingAddress = 'Address is required';
  return errors;
}

export function validateCard(card: CheckoutState['card']): FieldErrors {
  const errors: FieldErrors = {};
  if (!/^[0-9 -]{12,25}$/.test(card.cardNumber)) errors.cardNumber = 'Enter a valid card number';
  if (!/^(0[1-9]|1[0-2])\/[0-9]{2}$/.test(card.cardExpiry))
    errors.cardExpiry = 'Enter expiry as MM/YY';
  if (!/^[0-9]{3,4}$/.test(card.cardCvc)) errors.cardCvc = 'Enter a valid CVC';
  return errors;
}
