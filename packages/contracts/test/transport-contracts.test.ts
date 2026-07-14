import assert from 'node:assert/strict';
import test from 'node:test';
import { Value } from '@sinclair/typebox/value';
import * as AuthContracts from '../src/auth.js';
import { SignupBody } from '../src/auth.js';
import { CartIdParam } from '../src/cart.js';
import { PaymentBody } from '../src/payments.js';

void test('auth transport rejects unconstrained email and password values', () => {
  assert.equal(
    Value.Check(SignupBody, { email: 'not-an-email', password: '12345678', displayName: 'A' }),
    false,
  );
  assert.equal(
    Value.Check(SignupBody, { email: 'shopper@example.test', password: 'short', displayName: 'A' }),
    false,
  );
  assert.equal(
    Value.Check(SignupBody, {
      email: 'shopper@example.test',
      password: 'password8',
      displayName: 'A',
    }),
    true,
  );
});

void test('cart and payment transports require UUID identifiers and bounded card fields', () => {
  const uuid = '123e4567-e89b-42d3-a456-426614174000';
  assert.equal(Value.Check(CartIdParam, { cartId: 'cart-123' }), false);
  assert.equal(Value.Check(CartIdParam, { cartId: uuid }), true);

  const payment = {
    cartId: uuid,
    customerName: 'Ada Shopper',
    customerEmail: 'ada@example.test',
    shippingAddress: '1 Example Street, London',
    cardNumber: '4242 4242 4242 4242',
    cardExpiry: '12/99',
    cardCvc: '123',
    idempotencyKey: uuid,
  };
  assert.equal(Value.Check(PaymentBody, payment), true);
  assert.equal(Value.Check(PaymentBody, { ...payment, cardNumber: '4242-4242-4242-4242' }), true);
  assert.equal(Value.Check(PaymentBody, { ...payment, cardCvc: '1x3' }), false);
  assert.equal(Value.Check(PaymentBody, { ...payment, cardExpiry: '13/99' }), false);
});

void test('current-user transport contract accepts public user or null', () => {
  assert.ok('CurrentUserResponse' in AuthContracts, 'Missing CurrentUserResponse contract');
  const schema = (AuthContracts as Record<string, unknown>).CurrentUserResponse;
  assert.ok(schema && typeof schema === 'object');
  assert.equal(Value.Check(schema as Parameters<typeof Value.Check>[0], null), true);
  assert.equal(
    Value.Check(schema as Parameters<typeof Value.Check>[0], {
      id: '1',
      email: 'shopper@example.test',
      displayName: 'Shopper',
      role: 'customer',
    }),
    true,
  );
});
