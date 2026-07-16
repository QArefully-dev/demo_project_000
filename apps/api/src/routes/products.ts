import { FastifyInstance } from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { sendNotFound, sendBadRequest } from '../utils/errors.js';
import { toProductContract } from '../mappers/product.js';
import {
  ProductDetailResponse,
  ProductIdParam,
  CategoriesResponse,
  BestsellersResponse,
  RelatedResponse,
  ProductListPaginatedResponse,
  ProductFilterOptionsResponse,
  ProductQuery,
} from '@shop/contracts/products';
import { ErrorResponse } from '@shop/contracts/common';
import type { AppContext } from '../app.js';
import { CatalogQueryError } from '../features/catalog/catalogQuery.js';

export default function productsRoutes(app: FastifyInstance, { services }: AppContext): void {
  const typed = app.withTypeProvider<TypeBoxTypeProvider>();
  const { products } = services;

  // Static routes registered before /:id

  typed.get(
    '/api/products/filter-options',
    {
      schema: {
        response: {
          200: ProductFilterOptionsResponse,
        },
      },
    },
    () => products.listFilterOptions(),
  );

  // GET /api/products/categories
  typed.get(
    '/api/products/categories',
    {
      schema: {
        response: {
          200: CategoriesResponse,
        },
      },
    },
    () => {
      return products.listCategories();
    },
  );

  // GET /api/products/bestsellers
  typed.get(
    '/api/products/bestsellers',
    {
      schema: {
        response: {
          200: BestsellersResponse,
        },
      },
    },
    () => {
      return products.listBestsellers().map(toProductContract);
    },
  );

  // GET /api/products — paginated product list
  typed.get(
    '/api/products',
    {
      schema: {
        querystring: ProductQuery,
        response: {
          200: ProductListPaginatedResponse,
        },
      },
    },
    (request, reply) => {
      try {
        const result = products.list(request.query);
        return {
          items: result.items.map(toProductContract),
          total: result.total,
          page: result.page,
          pageSize: result.pageSize,
        };
      } catch (error) {
        if (error instanceof CatalogQueryError) {
          sendBadRequest(reply, error.message);
          return;
        }
        throw error;
      }
    },
  );

  // GET /api/products/:id — product detail
  typed.get(
    '/api/products/:id',
    {
      schema: {
        params: ProductIdParam,
        response: {
          200: ProductDetailResponse,
          400: ErrorResponse,
          404: ErrorResponse,
        },
      },
    },
    async (request, reply) => {
      const rawId = request.params.id;
      const productId = Number(rawId);

      // Validate: must be a positive integer
      if (!Number.isFinite(productId) || productId <= 0 || !Number.isInteger(productId)) {
        sendBadRequest(reply, 'Invalid product ID');
        return;
      }

      const product = products.findById(productId);
      if (!product) {
        sendNotFound(reply, 'Product');
        return;
      }
      return toProductContract(product);
    },
  );

  // GET /api/products/:id/related — related products
  typed.get(
    '/api/products/:id/related',
    {
      schema: {
        params: ProductIdParam,
        response: {
          200: RelatedResponse,
          400: ErrorResponse,
          404: ErrorResponse,
        },
      },
    },
    async (request, reply) => {
      const rawId = request.params.id;
      const productId = Number(rawId);

      if (!Number.isFinite(productId) || productId <= 0 || !Number.isInteger(productId)) {
        sendBadRequest(reply, 'Invalid product ID');
        return;
      }

      // Verify the product exists
      const product = products.findById(productId);
      if (!product) {
        sendNotFound(reply, 'Product');
        return;
      }

      return products.listRelated(productId).map(toProductContract);
    },
  );
}
