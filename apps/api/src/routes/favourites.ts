import { FastifyInstance } from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { requireAuth } from '../plugins/auth.js';
import { sendNotFound } from '../utils/errors.js';
import { toProductContract } from '../mappers/product.js';
import {
  AddFavouriteBody,
  FavouriteIdParam,
  FavouritesListResponse,
} from '@shop/contracts/favourites';
import { ErrorResponse, SuccessResponse } from '@shop/contracts/common';
import type { AppContext } from '../app.js';
/**
 * Favourites routes.
 * Authenticated users can list, add, and remove product favourites.
 */
export default function favouritesRoutes(app: FastifyInstance, { services }: AppContext): void {
  const typed = app.withTypeProvider<TypeBoxTypeProvider>();

  // GET /api/favourites
  typed.get(
    '/api/favourites',
    {
      preHandler: [requireAuth(services.sessions)],
      schema: {
        response: {
          200: FavouritesListResponse,
          401: ErrorResponse,
        },
      },
    },
    async (request, reply) => {
      const user = request.authenticatedUser!;
      const rows = services.favourites.list(user.id);
      reply.code(200).send(rows.map(toProductContract));
    },
  );

  // POST /api/favourites
  typed.post(
    '/api/favourites',
    {
      preHandler: [requireAuth(services.sessions)],
      schema: {
        body: AddFavouriteBody,
        response: {
          200: SuccessResponse,
          400: ErrorResponse,
          401: ErrorResponse,
        },
      },
    },
    async (request, reply) => {
      const user = request.authenticatedUser!;
      const numericId = Number(request.body.productId);

      const result = services.favourites.add(user.id, numericId);
      if (result === 'NOT_FOUND') {
        sendNotFound(reply, 'Product');
        return;
      }

      reply.code(200).send({ success: true as const });
    },
  );

  // DELETE /api/favourites/:productId
  typed.delete(
    '/api/favourites/:productId',
    {
      preHandler: [requireAuth(services.sessions)],
      schema: {
        params: FavouriteIdParam,
        response: {
          200: SuccessResponse,
          401: ErrorResponse,
          404: ErrorResponse,
        },
      },
    },
    async (request, reply) => {
      const user = request.authenticatedUser!;
      const numericId = Number(request.params.productId);

      const result = services.favourites.remove(user.id, numericId);
      if (result === 'NOT_FOUND') {
        sendNotFound(reply, 'Favourite');
        return;
      }

      reply.code(200).send({ success: true as const });
    },
  );
}
