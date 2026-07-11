import { FastifyInstance } from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { requireAuth } from '../plugins/auth.js';
import { sendNotImplemented } from '../utils/errors.js';
import {
  AddFavouriteBody,
  FavouriteIdParam,
  FavouritesListResponse,
  ErrorResponse,
  SuccessResponse,
} from '@shop/contracts';

/**
 * Favourites routes — stubs (Wave 0).
 * All endpoints return 501 "Not implemented".
 * Real implementation deferred to W2.A.
 */
export default function favouritesRoutes(app: FastifyInstance): void {
  const typed = app.withTypeProvider<TypeBoxTypeProvider>();

  // GET /api/favourites
  typed.get(
    '/api/favourites',
    {
      preHandler: [requireAuth],
      schema: {
        response: {
          200: FavouritesListResponse,
          401: ErrorResponse,
        },
      },
    },
    async (_request, reply) => {
      sendNotImplemented(reply);
    },
  );

  // POST /api/favourites
  typed.post(
    '/api/favourites',
    {
      preHandler: [requireAuth],
      schema: {
        body: AddFavouriteBody,
        response: {
          200: SuccessResponse,
          400: ErrorResponse,
          401: ErrorResponse,
        },
      },
    },
    async (_request, reply) => {
      sendNotImplemented(reply);
    },
  );

  // DELETE /api/favourites/:productId
  typed.delete(
    '/api/favourites/:productId',
    {
      preHandler: [requireAuth],
      schema: {
        params: FavouriteIdParam,
        response: {
          200: SuccessResponse,
          401: ErrorResponse,
          404: ErrorResponse,
        },
      },
    },
    async (_request, reply) => {
      sendNotImplemented(reply);
    },
  );
}
