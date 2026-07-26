import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { sendNotFound } from '../utils/errors.js';
import {
  Cart,
  type Cart as CartResponse,
  AddToCartBody,
  UpdateCartLineBody,
  CreateCartResponse,
  CartIdParam,
  CartIdAndProductIdParam,
  BelowMoqError,
  RemoveFromCartBody,
} from '@shop/contracts/cart';
import { ErrorResponse } from '@shop/contracts/common';
import { SACK_WEIGHT_GRAMS } from '@shop/contracts/pricing';
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
        response: {
          200: Cart,
          400: Type.Union([BelowMoqError, ErrorResponse]),
          404: ErrorResponse,
          409: ErrorResponse,
        },
      },
    },
    async (request, reply) => {
      const { productId, variantId, quantity } = request.body;
      let resolvedVariantId: string | null | undefined;
      if (variantId !== undefined) {
        resolvedVariantId = String(variantId);
      } else {
        const active = services.products
          .listVariants(Number(productId))
          .filter((v) => v.active === 1);
        if (active.length === 1) {
          resolvedVariantId = String(active[0]!.id);
        } else if (active.length === 0) {
          resolvedVariantId = undefined;
        } else {
          resolvedVariantId = null;
        }
      }

      if (resolvedVariantId === null) {
        return reply.code(400).send({
          error: `Product ${productId} has multiple active variants. Specify a variantId.`,
        });
      }
      if (resolvedVariantId === undefined) {
        return reply.code(400).send({
          error: `Product ${productId} has no active variants.`,
        });
      }

      const selectedVariant = services.products
        .listVariants(Number(productId))
        .find((variant) => variant.id === Number(resolvedVariantId));
      const requestedQuantity =
        quantity ??
        (selectedVariant
          ? minimumMoqQuantity(selectedVariant.weight_grams, selectedVariant.moq_sacks)
          : undefined);

      const cart = carts.add(
        request.params.cartId,
        resolvedVariantId,
        requestedQuantity,
        auditContext(request),
      );
      if (cart === 'CART_NOT_FOUND') {
        sendNotFound(reply, 'Cart');
        return;
      }
      if (cart === 'VARIANT_NOT_FOUND') {
        sendNotFound(reply, 'Variant');
        return;
      }
      if (cart === 'CART_RESERVED')
        return reply.code(409).send({ error: 'Cart is reserved for checkout' });
      if (cart === 'BELOW_MOQ') {
        return reply.code(400).send({
          code: 'BELOW_MOQ',
          error: 'Quantity does not meet this variant minimum order quantity.',
        });
      }
      if (cart === 'INVALID_QUANTITY') {
        return reply.code(400).send({ error: 'Quantity exceeds supported cart limits.' });
      }
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
        response: {
          200: Cart,
          400: Type.Union([BelowMoqError, ErrorResponse]),
          404: ErrorResponse,
          409: ErrorResponse,
        },
      },
    },
    async (request, reply) => {
      const { productId, variantId, configKey, quantity } = request.body;
      const cartData = carts.get(request.params.cartId);
      const resolvedVariantId = resolveCartLineVariant(cartData, productId, variantId, configKey);

      if (resolvedVariantId === 'AMBIGUOUS') {
        return reply.code(400).send({
          error: `Product ${productId} has multiple cart lines. Specify a variantId.`,
        });
      }
      if (resolvedVariantId === undefined) {
        sendNotFound(reply, 'Variant in cart');
        return;
      }

      const result = carts.update(
        request.params.cartId,
        resolvedVariantId,
        quantity,
        auditContext(request),
        configKey,
      );
      if (result === 'CART_NOT_FOUND') {
        sendNotFound(reply, 'Cart');
        return;
      }
      if (result === 'VARIANT_NOT_IN_CART') {
        sendNotFound(reply, 'Variant in cart');
        return;
      }
      if (result === 'CART_RESERVED')
        return reply.code(409).send({ error: 'Cart is reserved for checkout' });
      if (result === 'BELOW_MOQ') {
        return reply.code(400).send({
          code: 'BELOW_MOQ',
          error: 'Quantity does not meet this variant minimum order quantity.',
        });
      }
      if (result === 'INVALID_QUANTITY') {
        return reply.code(400).send({ error: 'Quantity exceeds supported cart limits.' });
      }
      return result;
    },
  );

  // Remove item from cart
  typed.delete(
    '/api/cart/:cartId/items/:productId',
    {
      schema: {
        params: CartIdAndProductIdParam,
        body: Type.Optional(RemoveFromCartBody),
        response: { 200: Cart, 400: ErrorResponse, 404: ErrorResponse, 409: ErrorResponse },
      },
    },
    async (request, reply) => {
      const productId = request.body?.productId ?? request.params.productId;
      if (request.body && request.body.productId !== request.params.productId) {
        return reply.code(400).send({ error: 'Body productId must match the cart line path.' });
      }
      const cartData = carts.get(request.params.cartId);
      const resolvedVariantId = resolveCartLineVariant(
        cartData,
        productId,
        request.body?.variantId,
        request.body?.configKey,
      );

      if (resolvedVariantId === 'AMBIGUOUS') {
        return reply.code(400).send({
          error: `Product ${productId} has multiple cart lines. Specify a variantId.`,
        });
      }
      if (resolvedVariantId === undefined) {
        sendNotFound(reply, 'Variant in cart');
        return;
      }

      const result = carts.remove(
        request.params.cartId,
        resolvedVariantId,
        auditContext(request),
        request.body?.configKey,
      );
      if (result === 'CART_NOT_FOUND') {
        sendNotFound(reply, 'Cart');
        return;
      }
      if (result === 'VARIANT_NOT_IN_CART') {
        sendNotFound(reply, 'Variant in cart');
        return;
      }
      if (result === 'CART_RESERVED')
        return reply.code(409).send({ error: 'Cart is reserved for checkout' });
      return result;
    },
  );
}

function resolveCartLineVariant(
  cart: CartResponse | undefined,
  productId: string,
  variantId: number | undefined,
  configKey: string | undefined,
): string | undefined {
  const matchingLines =
    cart?.items.filter(
      (item) => item.productId === productId && item.configKey === (configKey ?? ''),
    ) ?? [];
  if (variantId !== undefined) {
    return matchingLines.some((item) => item.variantSnap?.variantId === variantId)
      ? String(variantId)
      : undefined;
  }
  if (matchingLines.length !== 1) return matchingLines.length > 1 ? 'AMBIGUOUS' : undefined;
  const selected = matchingLines[0]?.variantSnap?.variantId;
  return selected ? String(selected) : undefined;
}

function minimumMoqQuantity(weightGrams: number, moqSacks: number): number {
  const quantity = Math.ceil((moqSacks * SACK_WEIGHT_GRAMS) / weightGrams);
  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    throw new RangeError('MOQ quantity is outside the safe integer range.');
  }
  return quantity;
}
