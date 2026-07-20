import { Type, type Static } from '@sinclair/typebox';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
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
import type { AppContext, AppServices } from '../app.js';

const CartIdParam = Type.Object({ cartId: Type.String({ format: 'uuid' }) });
const UnvalidatedPowderMixBody = Type.Object(
  {
    components: Type.Optional(Type.Unknown()),
    bagSizeGrams: Type.Optional(Type.Unknown()),
    fineness: Type.Optional(Type.Unknown()),
    customLabel: Type.Optional(Type.Unknown()),
    bagColourScheme: Type.Optional(Type.Unknown()),
  },
  { additionalProperties: false },
);
type UnvalidatedPowderMixBody = Static<typeof UnvalidatedPowderMixBody>;
const PowderizerBadRequestResponse = Type.Union([PowderizerValidationErrorResponse, ErrorResponse]);

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

function isCartMutationError(result: string): result is 'CART_NOT_FOUND' | 'CART_RESERVED' {
  return result === 'CART_NOT_FOUND' || result === 'CART_RESERVED';
}

function returnCart(carts: AppServices['carts'], cartId: string) {
  return carts.get(cartId);
}

export function handleConfig({ powderizer }: AppServices) {
  return () => powderizer.config();
}

export function handleQuote({ powderizer }: AppServices) {
  return (request: FastifyRequest) => powderizer.quote(request.body as never);
}

export function handleCreate({ powderizer, carts }: AppServices) {
  return (request: FastifyRequest<{ Params: { cartId: string } }>, reply: FastifyReply) => {
    const result = powderizer.create(request.params.cartId, request.body as never);
    if (isCartMutationError(result)) {
      sendMutationError(reply, result);
      return;
    }
    return returnCart(carts, request.params.cartId);
  };
}

export function handleUpdate({ powderizer, carts }: AppServices) {
  return (
    request: FastifyRequest<{ Params: { cartId: string; mixId: string } }>,
    reply: FastifyReply,
  ) => {
    const result = powderizer.update(
      request.params.cartId,
      request.params.mixId,
      request.body as never,
    );
    if (result) {
      sendMutationError(reply, result);
      return;
    }
    return returnCart(carts, request.params.cartId);
  };
}

export function handleUpdateQuantity({ powderizer, carts }: AppServices) {
  return (
    request: FastifyRequest<{
      Params: { cartId: string; mixId: string };
      Body: { quantity: number };
    }>,
    reply: FastifyReply,
  ) => {
    const result = powderizer.updateQuantity(
      request.params.cartId,
      request.params.mixId,
      request.body.quantity,
    );
    if (result) {
      sendMutationError(reply, result);
      return;
    }
    return returnCart(carts, request.params.cartId);
  };
}

export function handleRequote({ powderizer, carts }: AppServices) {
  return (
    request: FastifyRequest<{ Params: { cartId: string; mixId: string } }>,
    reply: FastifyReply,
  ) => {
    const result = powderizer.requote(request.params.cartId, request.params.mixId);
    if (result) {
      sendMutationError(reply, result);
      return;
    }
    return returnCart(carts, request.params.cartId);
  };
}

export function handleRemove({ powderizer, carts }: AppServices) {
  return (
    request: FastifyRequest<{ Params: { cartId: string; mixId: string } }>,
    reply: FastifyReply,
  ) => {
    const result = powderizer.remove(request.params.cartId, request.params.mixId);
    if (result) {
      sendMutationError(reply, result);
      return;
    }
    return returnCart(carts, request.params.cartId);
  };
}

export function registerCartMutations(app: FastifyInstance, services: AppServices): void {
  const typed = app.withTypeProvider<TypeBoxTypeProvider>();

  typed.post(
    `/api/cart/:cartId/mixes`,
    {
      schema: {
        params: CartIdParam,
        body: UnvalidatedPowderMixBody,
        response: {
          200: Cart,
          400: PowderizerBadRequestResponse,
          404: ErrorResponse,
          409: ErrorResponse,
        },
      },
    },
    handleCreate(services),
  );

  typed.patch(
    `/api/cart/:cartId/mixes/:mixId`,
    {
      schema: {
        params: CartIdAndMixIdParam,
        body: UnvalidatedPowderMixBody,
        response: {
          200: Cart,
          400: PowderizerBadRequestResponse,
          404: Type.Union([ErrorResponse, PowderMixNotFoundErrorResponse]),
          409: ErrorResponse,
        },
      },
    },
    handleUpdate(services),
  );

  typed.patch(
    `/api/cart/:cartId/mixes/:mixId/quantity`,
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
    handleUpdateQuantity(services),
  );

  typed.post(
    `/api/cart/:cartId/mixes/:mixId/requote`,
    {
      schema: {
        params: CartIdAndMixIdParam,
        response: {
          200: Cart,
          400: PowderizerBadRequestResponse,
          404: Type.Union([ErrorResponse, PowderMixNotFoundErrorResponse]),
          409: ErrorResponse,
        },
      },
    },
    handleRequote(services),
  );

  typed.delete(
    `/api/cart/:cartId/mixes/:mixId`,
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
    handleRemove(services),
  );
}

/** Registers config + quote at the given base path. Cart mutations shared once via registerCartMutations. */
export function registerPowderConfigAndQuote(
  app: FastifyInstance,
  services: AppServices,
  basePath: string,
): void {
  const typed = app.withTypeProvider<TypeBoxTypeProvider>();

  typed.get(
    `${basePath}/config`,
    { schema: { response: { 200: PowderizerConfigResponse } } },
    handleConfig(services),
  );

  typed.post(
    `${basePath}/quote`,
    {
      schema: {
        body: UnvalidatedPowderMixBody,
        response: { 200: PowderMixQuote, 400: PowderizerBadRequestResponse },
      },
    },
    handleQuote(services),
  );
}

/** Legacy compatibility — registers old /api/powderizer/ config+quote and shared cart mutations. */
export default function powderizerRoutes(app: FastifyInstance, { services }: AppContext): void {
  registerPowderConfigAndQuote(app, services, '/api/powderizer');
  registerCartMutations(app, services);
}
