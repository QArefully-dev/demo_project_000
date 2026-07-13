import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { requireAuth } from '../plugins/auth.js';
import { sendBadRequest, sendNotFound } from '../utils/errors.js';
import {
  listFavourites,
  addFavourite as addFavouriteDomain,
  removeFavourite as removeFavouriteDomain,
} from '../domains/favourites.js';
import type { ProductRow } from '../domains/products.js';
import {
  AddFavouriteBody,
  FavouriteIdParam,
  FavouritesListResponse,
  ErrorResponse,
  SuccessResponse,
} from '@shop/contracts';
import { getApiProductImages } from '../domains/productMedia.js';

function toProductContract(row: ProductRow) {
  return {
    id: String(row.id),
    name: row.name,
    description: row.description,
    priceCents: row.price_cents,
    imageSetId: row.image_set_id ?? 'unknown',
    images: getApiProductImages(row.image_set_id, row.category, row.name),
    category: row.category,
    stock: row.stock_count,
    slug: row.slug,
    compareAtPriceCents: row.compare_at_price_cents ?? undefined,
    salesCount: row.sales_count,
  };
}

/** Validate and parse a product ID from a string. Returns the numeric ID or null. */
function parseProductId(id: string): number | null {
  const parsed = Number(id);
  if (!Number.isFinite(parsed) || parsed <= 0 || !Number.isInteger(parsed)) return null;
  return parsed;
}

/**
 * Favourites routes.
 * Authenticated users can list, add, and remove product favourites.
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
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.authenticatedUser!;
      const rows = listFavourites(user.id);
      reply.code(200).send(rows.map(toProductContract));
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
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.authenticatedUser!;
      const { productId } = request.body as { productId: string };

      const numericId = parseProductId(productId);
      if (numericId === null) {
        sendBadRequest(reply, 'Invalid product ID');
        return;
      }

      const result = addFavouriteDomain(user.id, numericId);
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
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.authenticatedUser!;
      const { productId } = request.params as { productId: string };

      const numericId = parseProductId(productId);
      if (numericId === null) {
        sendBadRequest(reply, 'Invalid product ID');
        return;
      }

      const result = removeFavouriteDomain(user.id, numericId);
      if (result === 'NOT_FOUND') {
        sendNotFound(reply, 'Favourite');
        return;
      }

      reply.code(200).send({ success: true as const });
    },
  );
}
