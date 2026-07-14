import { describe, expect, it } from 'vitest';
import { validateCard, validateContact } from './checkoutValidation';

describe('checkout validation', () => {
  it('accepts trimmed valid contact fields and rejects email boundaries', () => {
    expect(
      validateContact({
        customerName: ' Ava ',
        customerEmail: 'ava@example.test ',
        shippingAddress: ' 1 Test Street ',
      }),
    ).toEqual({});
    expect(
      validateContact({ customerName: '', customerEmail: 'ava.example', shippingAddress: '' }),
    ).toEqual({
      customerName: 'Name is required',
      customerEmail: 'Enter a valid email',
      shippingAddress: 'Address is required',
    });
  });

  it('accepts 12-digit cards and rejects invalid expiry and CVC boundaries', () => {
    expect(
      validateCard({ cardNumber: '424242424242', cardExpiry: '01/30', cardCvc: '123' }),
    ).toEqual({});
    expect(validateCard({ cardNumber: '4242', cardExpiry: '00/30', cardCvc: '12' })).toEqual({
      cardNumber: 'Enter a valid card number',
      cardExpiry: 'Enter expiry as MM/YY',
      cardCvc: 'Enter a valid CVC',
    });
  });
});
