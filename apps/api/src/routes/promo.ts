import { FastifyInstance } from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { validatePromoCode, calculateDiscount } from '../domains/promo.js';
import { getCart } from '../domains/cart.js';
import { sendNotFound } from '../utils/errors.js';
import { ValidatePromoResponse, ValidatePromoBody, ErrorResponse } from '@shop/contracts';

export default function promoRoutes(app: FastifyInstance): void {
  const typed = app.withTypeProvider<TypeBoxTypeProvider>();

  /** POST /api/promo/validate — Validate a single promo code against a cart. No stacking: only one code evaluated per request. */
  typed.post(
    '/api/promo/validate',
    {
      schema: {
        body: ValidatePromoBody,
        response: { 200: ValidatePromoResponse, 400: ErrorResponse, 404: ErrorResponse },
      },
    },
    async (request, reply) => {
      const cart = getCart(request.body.cartId);
      if (!cart) {
        sendNotFound(reply, 'Cart');
        return;
      }
      const userId = request.authenticatedUser?.id ?? null;
      const result = validatePromoCode({
        code: request.body.promoCode,
        cartId: request.body.cartId,
        userId,
      });
      if (result.valid && result.promoCode) {
        const discountCents = calculateDiscount({
          promo: result.promoCode,
          subtotalCents: cart.subtotalCents,
        });
        const totalCents = cart.subtotalCents - discountCents;
        return { ...result, discountCents, totalCents };
      }
      return result;
    },
  );
}
