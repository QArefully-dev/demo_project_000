import { FastifyInstance } from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import {
  AddBundleToCartBody,
  BundleMutationConflictResponse,
  CuratedBundleListQuery,
  CuratedBundleListResponse,
} from '@shop/contracts/bundles';
import { CartIdParam, Cart } from '@shop/contracts/cart';
import { ErrorResponse } from '@shop/contracts/common';
import type { AppContext } from '../app.js';
import type { AuditContext } from '../features/audit/auditEvent.js';
import { sendNotFound } from '../utils/errors.js';

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

/** Customer bundle reads and fixed-component cart mutation endpoints. */
export default function bundleRoutes(app: FastifyInstance, { services }: AppContext): void {
  const typed = app.withTypeProvider<TypeBoxTypeProvider>();
  const { bundles } = services;

  typed.get(
    '/api/bundles',
    {
      schema: {
        querystring: CuratedBundleListQuery,
        response: { 200: CuratedBundleListResponse, 400: ErrorResponse },
      },
    },
    (request) => bundles.list(request.query.productId, request.resolvedCountry),
  );

  typed.post(
    '/api/cart/:cartId/bundles',
    {
      schema: {
        params: CartIdParam,
        body: AddBundleToCartBody,
        response: {
          200: Cart,
          400: ErrorResponse,
          404: ErrorResponse,
          409: BundleMutationConflictResponse,
        },
      },
    },
    async (request, reply) => {
      const result = bundles.addToCart(
        request.params.cartId,
        request.body.bundleId,
        auditContext(request),
      );
      if (result === 'CART_NOT_FOUND') {
        sendNotFound(reply, 'Cart');
        return;
      }
      if (result === 'BUNDLE_NOT_FOUND') {
        sendNotFound(reply, 'Bundle');
        return;
      }
      if (result === 'CART_RESERVED') {
        return reply.code(409).send({ error: 'Cart is reserved for checkout' });
      }
      if (
        typeof result === 'object' &&
        'error' in result &&
        result.error === 'BUNDLE_UNAVAILABLE'
      ) {
        const body = {
          code: 'BUNDLE_UNAVAILABLE',
          error: 'One or more bundle components are unavailable',
          productIds: result.variantIds,
        };
        return reply.code(409).send(body);
      }
      return result;
    },
  );
}
