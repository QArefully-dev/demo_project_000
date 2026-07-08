import { FastifyInstance } from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import {
  createCart,
  getCart,
  addItemToCart,
  updateCartItem,
  removeCartItem,
} from '../domains/cart.js';
import { sendNotFound } from '../utils/errors.js';
import {
  Cart,
  AddToCartBody,
  UpdateCartLineBody,
  CreateCartResponse,
  ErrorResponse,
  CartIdParam,
  CartIdAndProductIdParam,
} from '@shop/contracts';

export default function cartRoutes(app: FastifyInstance): void {
  const typed = app.withTypeProvider<TypeBoxTypeProvider>();

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
    async (_, reply) => {
      const { cartId } = createCart();
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
        response: { 200: Cart, 400: ErrorResponse, 404: ErrorResponse },
      },
    },
    async (request, reply) => {
      const cart = getCart(request.params.cartId);
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
        response: { 200: Cart, 400: ErrorResponse, 404: ErrorResponse },
      },
    },
    async (request, reply) => {
      const cart = addItemToCart(request.params.cartId, request.body.productId);
      if (cart === 'CART_NOT_FOUND') {
        sendNotFound(reply, 'Cart');
        return;
      }
      if (cart === 'PRODUCT_NOT_FOUND') {
        sendNotFound(reply, 'Product');
        return;
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
        response: { 200: Cart, 400: ErrorResponse, 404: ErrorResponse },
      },
    },
    async (request, reply) => {
      const result = updateCartItem(
        request.params.cartId,
        request.body.productId,
        request.body.quantity,
      );
      if (result === 'CART_NOT_FOUND') {
        sendNotFound(reply, 'Cart');
        return;
      }
      if (result === 'PRODUCT_NOT_IN_CART') {
        sendNotFound(reply, 'Product in cart');
        return;
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
        response: { 200: Cart, 400: ErrorResponse, 404: ErrorResponse },
      },
    },
    async (request, reply) => {
      const result = removeCartItem(request.params.cartId, request.params.productId);
      if (result === 'CART_NOT_FOUND') {
        sendNotFound(reply, 'Cart');
        return;
      }
      if (result === 'PRODUCT_NOT_IN_CART') {
        sendNotFound(reply, 'Product in cart');
        return;
      }
      return result;
    },
  );
}
