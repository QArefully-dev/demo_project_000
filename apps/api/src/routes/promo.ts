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
      const result = validatePromoCode(
        request.body.promoCode,
        request.body.cartId,
        cart.totalItems,
      );
      if (result.valid && result.promoCode) {
        const discountCents = calculateDiscount(
          cart.subtotalCents,
          result.promoCode.discountPercent,
        );
        const totalCents = cart.subtotalCents - discountCents;
        return { ...result, discountCents, totalCents };
      }
      return result;
    },
  );
}
