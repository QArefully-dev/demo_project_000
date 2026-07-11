import { FastifyInstance } from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { listProducts, getProductById } from '../domains/products.js';
import { sendNotFound, sendBadRequest, sendNotImplemented } from '../utils/errors.js';
import {
  ProductDetailResponse,
  ErrorResponse,
  ProductIdParam,
  CategoriesResponse,
  BestsellersResponse,
  RelatedResponse,
  ProductListPaginatedResponse,
} from '@shop/contracts';

export default function productsRoutes(app: FastifyInstance): void {
  const typed = app.withTypeProvider<TypeBoxTypeProvider>();

  // Static routes registered before /:id

  // GET /api/products — paginated product list
  typed.get(
    '/api/products',
    {
      schema: {
        response: {
          200: ProductListPaginatedResponse,
        },
      },
    },
    () => {
      const rows = listProducts();
      const items = rows.map((r) => ({
        id: String(r.id),
        name: r.name,
        description: r.description,
        priceCents: r.price_cents,
        imageUrl: r.image_url,
        category: r.category,
        stock: r.stock_count,
        slug: r.slug ?? '',
        compareAtPriceCents: r.compare_at_price_cents ?? undefined,
        salesCount: r.sales_count ?? 0,
      }));
      return {
        items,
        total: items.length,
        page: 1,
        pageSize: items.length || 12,
      };
    },
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
      const rows = listProducts();
      const categories = [...new Set(rows.map((r) => r.category))].sort();
      return categories;
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
      const rows = listProducts()
        .filter((r) => (r.sales_count ?? 0) >= 250)
        .sort((a, b) => (b.sales_count ?? 0) - (a.sales_count ?? 0))
        .slice(0, 8);
      return rows.map((r) => ({
        id: String(r.id),
        name: r.name,
        description: r.description,
        priceCents: r.price_cents,
        imageUrl: r.image_url,
        category: r.category,
        stock: r.stock_count,
        slug: r.slug ?? '',
        compareAtPriceCents: r.compare_at_price_cents ?? undefined,
        salesCount: r.sales_count ?? 0,
      }));
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
      const productId = Number(request.params.id);
      if (Number.isNaN(productId)) {
        sendBadRequest(reply, 'Invalid product ID');
        return;
      }
      const product = getProductById(productId);
      if (!product) {
        sendNotFound(reply, 'Product');
        return;
      }
      return {
        id: String(product.id),
        name: product.name,
        description: product.description,
        priceCents: product.price_cents,
        imageUrl: product.image_url,
        category: product.category,
        stock: product.stock_count,
        slug: product.slug ?? '',
        compareAtPriceCents: product.compare_at_price_cents ?? undefined,
        salesCount: product.sales_count ?? 0,
      };
    },
  );

  // GET /api/products/:id/related — stub
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
    async (_request, reply) => {
      sendNotImplemented(reply);
    },
  );
}
