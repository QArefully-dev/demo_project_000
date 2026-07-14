import { Type, type Static } from '@sinclair/typebox';
import { FastifyInstance, type FastifyReply } from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Cart } from '@shop/contracts/cart';
import { ErrorResponse } from '@shop/contracts/common';
import {
  CartIdAndMixIdParam,
  PowderMixNotFoundErrorResponse,
  PowderMixQuote,
  PowderizerConfigResponse,
  PowderizerValidationErrorResponse,
  UpdatePowderMixQuantityBody,
} from '@shop/contracts/powderizer';
import { PowderMixDomainError } from '../features/powderizer/powderizerTypes.js';
import type { AppContext } from '../app.js';

const CartIdParam = Type.Object({ cartId: Type.String({ format: 'uuid' }) });
const UnvalidatedPowderMixBody = Type.Unknown();
type UnvalidatedPowderMixBody = Static<typeof UnvalidatedPowderMixBody>;

function sendMutationError(
  reply: FastifyReply,
  result: 'CART_NOT_FOUND' | 'CART_RESERVED' | 'MIX_NOT_FOUND',
): void {
  if (result === 'CART_NOT_FOUND') {
    void reply.code(404).send({ error: 'Cart not found' });
    return;
  }
  if (result === 'CART_RESERVED') {
    void reply.code(409).send({ error: 'Cart is reserved for checkout' });
    return;
  }
  void reply.code(404).send({ code: 'MIX_NOT_FOUND', error: 'Mix not found' });
}

/** HTTP entry points for stateless quotes and cart-scoped Powderizer mutations. */
export default function powderizerRoutes(app: FastifyInstance, { services }: AppContext): void {
  const typed = app.withTypeProvider<TypeBoxTypeProvider>();
  const { powderizer, carts } = services;

  const returnCart = (cartId: string) => carts.get(cartId);
  const handleDomainError = (error: unknown, reply: FastifyReply): void => {
    if (!(error instanceof PowderMixDomainError)) throw error;
    void reply.code(400).send({ code: error.code, error: error.message, field: error.field });
  };

  typed.get(
    '/api/powderizer/config',
    { schema: { response: { 200: PowderizerConfigResponse } } },
    () => powderizer.config(),
  );

  typed.post(
    '/api/powderizer/quote',
    {
      schema: {
        body: UnvalidatedPowderMixBody,
        response: { 200: PowderMixQuote, 400: PowderizerValidationErrorResponse },
      },
    },
    (request, reply) => {
      try {
        return powderizer.quote(request.body as never);
      } catch (error) {
        handleDomainError(error, reply);
        return;
      }
    },
  );

  typed.post(
    '/api/cart/:cartId/mixes',
    {
      schema: {
        params: CartIdParam,
        body: UnvalidatedPowderMixBody,
        response: {
          200: Cart,
          400: PowderizerValidationErrorResponse,
          404: ErrorResponse,
          409: ErrorResponse,
        },
      },
    },
    (request, reply) => {
      try {
        const result = powderizer.create(request.params.cartId, request.body as never);
        if (result === 'CART_NOT_FOUND' || result === 'CART_RESERVED') {
          sendMutationError(reply, result);
          return;
        }
        return returnCart(request.params.cartId);
      } catch (error) {
        handleDomainError(error, reply);
        return;
      }
    },
  );

  typed.patch(
    '/api/cart/:cartId/mixes/:mixId',
    {
      schema: {
        params: CartIdAndMixIdParam,
        body: UnvalidatedPowderMixBody,
        response: {
          200: Cart,
          400: PowderizerValidationErrorResponse,
          404: Type.Union([ErrorResponse, PowderMixNotFoundErrorResponse]),
          409: ErrorResponse,
        },
      },
    },
    (request, reply) => {
      try {
        const result = powderizer.update(
          request.params.cartId,
          request.params.mixId,
          request.body as never,
        );
        if (result) {
          sendMutationError(reply, result);
          return;
        }
        return returnCart(request.params.cartId);
      } catch (error) {
        handleDomainError(error, reply);
        return;
      }
    },
  );

  typed.patch(
    '/api/cart/:cartId/mixes/:mixId/quantity',
    {
      schema: {
        params: CartIdAndMixIdParam,
        body: UpdatePowderMixQuantityBody,
        response: {
          200: Cart,
          404: Type.Union([ErrorResponse, PowderMixNotFoundErrorResponse]),
          409: ErrorResponse,
        },
      },
    },
    (request, reply) => {
      const result = powderizer.updateQuantity(
        request.params.cartId,
        request.params.mixId,
        request.body.quantity,
      );
      if (result) {
        sendMutationError(reply, result);
        return;
      }
      return returnCart(request.params.cartId);
    },
  );

  typed.post(
    '/api/cart/:cartId/mixes/:mixId/requote',
    {
      schema: {
        params: CartIdAndMixIdParam,
        response: {
          200: Cart,
          400: PowderizerValidationErrorResponse,
          404: Type.Union([ErrorResponse, PowderMixNotFoundErrorResponse]),
          409: ErrorResponse,
        },
      },
    },
    (request, reply) => {
      try {
        const result = powderizer.requote(request.params.cartId, request.params.mixId);
        if (result) {
          sendMutationError(reply, result);
          return;
        }
        return returnCart(request.params.cartId);
      } catch (error) {
        handleDomainError(error, reply);
        return;
      }
    },
  );

  typed.delete(
    '/api/cart/:cartId/mixes/:mixId',
    {
      schema: {
        params: CartIdAndMixIdParam,
        response: {
          200: Cart,
          404: Type.Union([ErrorResponse, PowderMixNotFoundErrorResponse]),
          409: ErrorResponse,
        },
      },
    },
    (request, reply) => {
      const result = powderizer.remove(request.params.cartId, request.params.mixId);
      if (result) {
        sendMutationError(reply, result);
        return;
      }
      return returnCart(request.params.cartId);
    },
  );
}
