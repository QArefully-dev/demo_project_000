import { FastifyInstance } from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import {
  listProducts,
  getProductById,
  getCategories,
  getBestsellers,
  getRelatedProducts,
} from '../domains/products.js';
import { sendNotFound, sendBadRequest } from '../utils/errors.js';
import {
  ProductDetailResponse,
  ErrorResponse,
  ProductIdParam,
  CategoriesResponse,
  BestsellersResponse,
  RelatedResponse,
  ProductListPaginatedResponse,
  ProductQuery,
  type Product,
} from '@shop/contracts';

/** Map a database product row to the API contract shape. */
function mapProduct(row: {
  id: number;
  name: string;
  description: string;
  price_cents: number;
  category: string;
  stock_count: number;
  image_url: string;
  slug: string;
  compare_at_price_cents: number | null;
  sales_count: number;
}): Product {
  return {
    id: String(row.id),
    name: row.name,
    description: row.description,
    priceCents: row.price_cents,
    imageUrl: row.image_url,
    category: row.category,
    stock: row.stock_count,
    slug: row.slug ?? '',
    compareAtPriceCents: row.compare_at_price_cents ?? undefined,
    salesCount: row.sales_count ?? 0,
  };
}

export default function productsRoutes(app: FastifyInstance): void {
  const typed = app.withTypeProvider<TypeBoxTypeProvider>();

  // Static routes registered before /:id

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
      return getCategories();
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
      return getBestsellers().map(mapProduct);
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
    (request) => {
      const result = listProducts(request.query);
      return {
        items: result.items.map(mapProduct),
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
      };
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

      const product = getProductById(productId);
      if (!product) {
        sendNotFound(reply, 'Product');
        return;
      }
      return mapProduct(product);
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
      const product = getProductById(productId);
      if (!product) {
        sendNotFound(reply, 'Product');
        return;
      }

      return getRelatedProducts(productId).map(mapProduct);
    },
  );
}
