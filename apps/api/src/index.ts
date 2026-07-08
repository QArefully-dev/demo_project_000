import Fastify, { type FastifyError } from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { getDb, seedDatabase } from './db/index.js';
import productsRoutes from './routes/products.js';
import cartRoutes from './routes/cart.js';
import promoRoutes from './routes/promo.js';
import ordersRoutes from './routes/orders.js';
import type { ErrorResponse } from '@shop/contracts';

const app = Fastify({ logger: true }).withTypeProvider<TypeBoxTypeProvider>();

// Global error handler
app.setErrorHandler((error: FastifyError, _request, reply) => {
  if (error.validation) {
    reply.code(400).send({ error: error.message, details: error.validation });
    return;
  }
  if (error.statusCode === 404) {
    reply.code(404).send({ error: error.message });
    return;
  }
  reply.code(error.statusCode || 500).send({ error: error.message || 'Internal server error' });
});

app.setNotFoundHandler((request, reply) => {
  const body: ErrorResponse = { error: `Route ${request.method} ${request.url} not found` };
  reply.code(404).send(body);
});

// Health check
app.get('/health', () => {
  return { status: 'ok' };
});

// Register routes
await app.register(productsRoutes);
await app.register(cartRoutes);
await app.register(promoRoutes);
await app.register(ordersRoutes);

// Initialize database on startup
const db = getDb();
seedDatabase(db);

// Start server
try {
  await app.listen({ port: 3001, host: '127.0.0.1' });
  app.log.info('API server listening on http://127.0.0.1:3001');
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
