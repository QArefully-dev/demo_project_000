import type { FastifyInstance, FastifyReply } from 'fastify';
import { Type } from '@sinclair/typebox';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import {
  CustomBlendErrorResponse,
  CustomBlendOptionsQuery,
  CustomBlendOptionsResponse,
  CreateCustomBlendBody,
  ErrorResponse,
  ReplaceCustomBlendBody,
  Cart,
  CartIdParam,
} from '@shop/contracts';
import type { AppContext } from '../app.js';
import { CustomBlendInvalidError } from '../features/customBlend/customBlendService.js';
import type { AuditContext } from '../features/audit/auditEvent.js';
import type { Cart as CartResponse } from '@shop/contracts/cart';

function auditContext(request: {
  id: string;
  authenticatedUser: { id: number } | null;
}): AuditContext {
  return {
    actor: request.authenticatedUser
      ? { type: 'user', userId: request.authenticatedUser.id }
      : { type: 'anonymous', userId: null },
    requestId: request.id,
  };
}

/** Public read endpoint for eligible base and compatible ingredient lots. */
export default function customBlendRoutes(app: FastifyInstance, { services }: AppContext): void {
  const typed = app.withTypeProvider<TypeBoxTypeProvider>();

  typed.get(
    '/api/custom-blends/options',
    {
      schema: {
        querystring: CustomBlendOptionsQuery,
        response: {
          200: CustomBlendOptionsResponse,
          400: Type.Union([CustomBlendErrorResponse, ErrorResponse]),
        },
      },
    },
    (request, reply) => {
      try {
        return services.customBlends.listOptions(request.query.baseVariantId);
      } catch (error) {
        if (error instanceof CustomBlendInvalidError) {
          reply.code(400).send({ code: 'CUSTOM_BLEND_INVALID', error: error.message });
          return;
        }
        throw error;
      }
    },
  );

  typed.post(
    '/api/cart/:cartId/custom-blends',
    {
      schema: {
        params: CartIdParam,
        body: CreateCustomBlendBody,
        response: {
          200: Cart,
          400: Type.Union([CustomBlendErrorResponse, ErrorResponse]),
          404: ErrorResponse,
          409: ErrorResponse,
        },
      },
    },
    (request, reply) => {
      try {
        const result = services.customBlends.create(
          services.carts,
          request.params.cartId,
          request.body,
          auditContext(request),
        );
        return sendMutationResult(reply, result);
      } catch (error) {
        if (error instanceof CustomBlendInvalidError) {
          reply.code(400).send({ code: 'CUSTOM_BLEND_INVALID', error: error.message });
          return;
        }
        throw error;
      }
    },
  );

  typed.put(
    '/api/cart/:cartId/custom-blends',
    {
      schema: {
        params: CartIdParam,
        body: ReplaceCustomBlendBody,
        response: {
          200: Cart,
          400: Type.Union([CustomBlendErrorResponse, ErrorResponse]),
          404: ErrorResponse,
          409: ErrorResponse,
        },
      },
    },
    (request, reply) => {
      try {
        const result = services.customBlends.replace(
          services.carts,
          request.params.cartId,
          request.body,
          auditContext(request),
        );
        return sendMutationResult(reply, result);
      } catch (error) {
        if (error instanceof CustomBlendInvalidError) {
          reply.code(400).send({ code: 'CUSTOM_BLEND_INVALID', error: error.message });
          return;
        }
        throw error;
      }
    },
  );
}

function sendMutationResult(
  reply: FastifyReply,
  result:
    | import('@shop/contracts').Cart
    | 'CART_NOT_FOUND'
    | 'VARIANT_NOT_FOUND'
    | 'VARIANT_NOT_IN_CART'
    | 'CART_RESERVED'
    | 'BELOW_MOQ'
    | 'INVALID_QUANTITY',
): CartResponse | void {
  if (typeof result !== 'string') return result;
  if (result === 'CART_NOT_FOUND') {
    reply.code(404).send({ error: 'Cart not found' });
    return;
  }
  if (result === 'VARIANT_NOT_FOUND' || result === 'VARIANT_NOT_IN_CART') {
    reply.code(404).send({ error: 'Variant in cart not found' });
    return;
  }
  if (result === 'CART_RESERVED') {
    reply.code(409).send({ error: 'Cart is reserved for checkout' });
    return;
  }
  if (result === 'BELOW_MOQ') {
    reply.code(400).send({
      code: 'BELOW_MOQ',
      error: 'Quantity does not meet this variant minimum order quantity.',
    });
    return;
  }
  reply.code(400).send({ error: 'Quantity exceeds supported cart limits.' });
}
