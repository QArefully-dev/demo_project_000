import { FastifyInstance } from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { sendNotFound, sendBadRequest } from '../utils/errors.js';
import { toProductContract, toProductWithVariantsContract } from '../mappers/product.js';
import {
  ProductComparisonQuery,
  ProductComparisonResponse,
  ProductIdParam,
  CategoriesResponse,
  BestsellersResponse,
  RelatedResponse,
  SimilarProductsResponse,
  ProductListPaginatedResponse,
  ProductFilterOptionsResponse,
  ProductQuery,
  ProductWithVariants,
} from '@shop/contracts/products';
import { ErrorResponse } from '@shop/contracts/common';
import type { AppContext } from '../app.js';
import { CatalogQueryError } from '../features/catalog/catalogQuery.js';
import { ComparisonSelectionError } from '../features/catalog/productComparison.js';

export default function productsRoutes(app: FastifyInstance, { services }: AppContext): void {
  const typed = app.withTypeProvider<TypeBoxTypeProvider>();
  const { products } = services;

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

  typed.get(
    '/api/products/compare',
    {
      schema: {
        querystring: ProductComparisonQuery,
        response: {
          200: ProductComparisonResponse,
          400: ErrorResponse,
        },
      },
    },
    (request, reply) => {
      try {
        return products.compare(request.query.ids);
      } catch (error) {
        if (error instanceof ComparisonSelectionError) {
          sendBadRequest(reply, error.message);
          return;
        }
        throw error;
      }
    },
  );

  typed.get(
    '/api/products/:id',
    {
      schema: {
        params: ProductIdParam,
        response: {
          200: ProductWithVariants,
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

      const product = products.findCustomerProductById(productId);
      if (!product) {
        sendNotFound(reply, 'Product');
        return;
      }
      const variants = products.listVariants(productId);
      return toProductWithVariantsContract(product, variants);
    },
  );

  typed.get(
    '/api/products/:id/similar',
    {
      schema: {
        params: ProductIdParam,
        response: {
          200: SimilarProductsResponse,
          400: ErrorResponse,
          404: ErrorResponse,
        },
      },
    },
    async (request, reply) => {
      const productId = Number(request.params.id);
      if (!Number.isFinite(productId) || productId <= 0 || !Number.isInteger(productId)) {
        sendBadRequest(reply, 'Invalid product ID');
        return;
      }

      const similar = products.listSimilar(productId);
      if (!similar) {
        sendNotFound(reply, 'Product');
        return;
      }
      return similar.map(toProductContract);
    },
  );

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

      const similar = products.listRelated(productId);
      if (!similar) {
        sendNotFound(reply, 'Product');
        return;
      }
      return similar.map(toProductContract);
    },
  );
}
