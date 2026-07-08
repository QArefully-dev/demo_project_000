import { FastifyInstance } from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { listProducts, getProductById } from '../domains/products.js';
import { sendNotFound, sendBadRequest } from '../utils/errors.js';
import {
  ProductListResponse,
  ProductDetailResponse,
  ErrorResponse,
  ProductIdParam,
} from '@shop/contracts';

export default function productsRoutes(app: FastifyInstance): void {
  const typed = app.withTypeProvider<TypeBoxTypeProvider>();

  typed.get(
    '/api/products',
    {
      schema: {
        response: {
          200: ProductListResponse,
        },
      },
    },
    () => {
      const rows = listProducts();
      return rows.map((r) => ({
        id: String(r.id),
        name: r.name,
        description: r.description,
        priceCents: r.price_cents,
        imageUrl: r.image_url,
        category: r.category,
        stock: r.stock_count,
      }));
    },
  );

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
      };
    },
  );
}
