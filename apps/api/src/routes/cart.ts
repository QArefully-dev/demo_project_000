import { FastifyInstance } from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { sendNotFound } from '../utils/errors.js';
import {
  Cart,
  AddToCartBody,
  UpdateCartLineBody,
  CreateCartResponse,
  CartIdParam,
  CartIdAndProductIdParam,
} from '@shop/contracts/cart';
import { ErrorResponse } from '@shop/contracts/common';
import type { AppContext } from '../app.js';
import type { AuditContext } from '../features/audit/auditEvent.js';

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

export default function cartRoutes(app: FastifyInstance, { services }: AppContext): void {
  const typed = app.withTypeProvider<TypeBoxTypeProvider>();
  const { carts } = services;

  // Create cart
  typed.post(
    '/api/cart',
    {
      schema: {
        response: {
          201: CreateCartResponse,
        },
      },
    },
    async (request, reply) => {
      const { cartId } = carts.create(auditContext(request));
      reply.code(201);
      return { cartId };
    },
  );

  // Get cart
  typed.get(
    '/api/cart/:cartId',
    {
      schema: {
        params: CartIdParam,
        response: { 200: Cart, 400: ErrorResponse, 404: ErrorResponse, 409: ErrorResponse },
      },
    },
    async (request, reply) => {
      const cart = carts.get(request.params.cartId);
      if (!cart) {
        sendNotFound(reply, 'Cart');
        return;
      }
      return cart;
    },
  );

  // Add item to cart
  typed.post(
    '/api/cart/:cartId/items',
    {
      schema: {
        params: CartIdParam,
        body: AddToCartBody,
        response: { 200: Cart, 400: ErrorResponse, 404: ErrorResponse, 409: ErrorResponse },
      },
    },
    async (request, reply) => {
      const cart = carts.add(request.params.cartId, request.body.productId, auditContext(request));
      if (cart === 'CART_NOT_FOUND') {
        sendNotFound(reply, 'Cart');
        return;
      }
      if (cart === 'PRODUCT_NOT_FOUND') {
        sendNotFound(reply, 'Product');
        return;
      }
      if (cart === 'CART_RESERVED')
        return reply.code(409).send({ error: 'Cart is reserved for checkout' });
      return cart;
    },
  );

  // Update cart item quantity
  typed.patch(
    '/api/cart/:cartId/items',
    {
      schema: {
        params: CartIdParam,
        body: UpdateCartLineBody,
        response: { 200: Cart, 400: ErrorResponse, 404: ErrorResponse, 409: ErrorResponse },
      },
    },
    async (request, reply) => {
      const result = carts.update(
        request.params.cartId,
        request.body.productId,
        request.body.quantity,
        auditContext(request),
      );
      if (result === 'CART_NOT_FOUND') {
        sendNotFound(reply, 'Cart');
        return;
      }
      if (result === 'PRODUCT_NOT_IN_CART') {
        sendNotFound(reply, 'Product in cart');
        return;
      }
      if (result === 'CART_RESERVED')
        return reply.code(409).send({ error: 'Cart is reserved for checkout' });
      return result;
    },
  );

  // Remove item from cart
  typed.delete(
    '/api/cart/:cartId/items/:productId',
    {
      schema: {
        params: CartIdAndProductIdParam,
        response: { 200: Cart, 400: ErrorResponse, 404: ErrorResponse, 409: ErrorResponse },
      },
    },
    async (request, reply) => {
      const result = carts.remove(
        request.params.cartId,
        request.params.productId,
        auditContext(request),
      );
      if (result === 'CART_NOT_FOUND') {
        sendNotFound(reply, 'Cart');
        return;
      }
      if (result === 'PRODUCT_NOT_IN_CART') {
        sendNotFound(reply, 'Product in cart');
        return;
      }
      if (result === 'CART_RESERVED')
        return reply.code(409).send({ error: 'Cart is reserved for checkout' });
      return result;
    },
  );
}
