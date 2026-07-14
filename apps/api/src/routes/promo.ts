import { FastifyInstance } from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { calculateDiscount } from '../features/promos/promoService.js';
import { sendNotFound } from '../utils/errors.js';
import { ValidatePromoResponse, ValidatePromoBody } from '@shop/contracts/promos';
import { ErrorResponse } from '@shop/contracts/common';
import type { AppContext } from '../app.js';

export default function promoRoutes(app: FastifyInstance, { services }: AppContext): void {
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
      const cart = services.carts.get(request.body.cartId);
      if (!cart) {
        sendNotFound(reply, 'Cart');
        return;
      }
      const userId = request.authenticatedUser?.id ?? null;
      const result = services.promos.validate({
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
