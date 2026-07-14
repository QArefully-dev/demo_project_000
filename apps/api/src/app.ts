import Fastify, { type FastifyError } from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import fastifyCookie from '@fastify/cookie';
import type Database from 'better-sqlite3';
import type { ErrorResponse } from '@shop/contracts/common';
import { authPlugin } from './plugins/auth.js';
import productsRoutes from './routes/products.js';
import cartRoutes from './routes/cart.js';
import promoRoutes from './routes/promo.js';
import ordersRoutes from './routes/orders.js';
import authRoutes from './routes/auth.js';
import favouritesRoutes from './routes/favourites.js';
import paymentRoutes from './routes/payments.js';
import mailboxRoutes from './routes/mailbox.js';
import powderizerRoutes from './routes/powderizer.js';
import { createAuthService, type AuthService, type Clock } from './features/auth/authService.js';
import { createSessionRepository } from './features/auth/sessionRepository.js';
import { createSessionService, type SessionService } from './features/auth/sessionService.js';
import { createUserRepository } from './features/auth/userRepository.js';
import { createProductRepository } from './features/catalog/productRepository.js';
import { createProductService, type ProductService } from './features/catalog/productService.js';
import { createCartRepository } from './features/cart/cartRepository.js';
import { createCartService, type CartService } from './features/cart/cartService.js';
import { createOrderRepository } from './features/checkout/orderRepository.js';
import { createOrderService, type OrderService } from './features/checkout/orderService.js';
import {
  createCheckoutService,
  type CheckoutService,
} from './features/checkout/checkoutService.js';
import { createFavouritesRepository } from './features/favourites/favouritesRepository.js';
import {
  createFavouritesService,
  type FavouritesService,
} from './features/favourites/favouritesService.js';
import {
  createMailboxRepository,
  type MailboxRepository,
} from './features/mailbox/mailboxRepository.js';
import { createPasswordResetRepository } from './features/passwordReset/passwordResetRepository.js';
import {
  createPasswordResetService,
  type PasswordResetService,
  type ResetTokenSource,
} from './features/passwordReset/passwordResetService.js';
import { createPromoRepository } from './features/promos/promoRepository.js';
import { createPromoService, type PromoService } from './features/promos/promoService.js';
import { createPaymentRepository } from './features/payments/paymentRepository.js';
import { simulatedPaymentGateway } from './features/payments/paymentGateway.js';
import { createUnitOfWork } from './db/unitOfWork.js';
import { createPowderMixRepository } from './features/powderizer/powderMixRepository.js';
import {
  createPowderizerService,
  type PowderizerService,
} from './features/powderizer/powderizerService.js';

export interface AppDependencies {
  db: Database.Database;
  resetBaseUrl: string;
  clock?: Clock;
  resetTokenSource?: ResetTokenSource;
}

export interface AppServices {
  auth: AuthService;
  sessions: SessionService;
  passwordReset: PasswordResetService;
  mailbox: MailboxRepository;
  products: ProductService;
  carts: CartService;
  promos: PromoService;
  orders: OrderService;
  checkout: CheckoutService;
  favourites: FavouritesService;
  powderizer: PowderizerService;
}

export type AppContext = { services: AppServices };

function createAppServices(dependencies: AppDependencies): AppServices {
  const clock = dependencies.clock ?? { now: () => new Date() };
  const mailbox = createMailboxRepository(dependencies.db);
  const carts = createCartRepository(dependencies.db);
  const promos = createPromoRepository(dependencies.db);
  const orders = createOrderRepository(dependencies.db);
  const products = createProductRepository(dependencies.db);
  const mixes = createPowderMixRepository(dependencies.db);
  return {
    auth: createAuthService({ users: createUserRepository(dependencies.db), clock }),
    sessions: createSessionService({ sessions: createSessionRepository(dependencies.db), clock }),
    passwordReset: createPasswordResetService({
      repository: createPasswordResetRepository(dependencies.db),
      mailbox,
      clock,
      baseUrl: dependencies.resetBaseUrl,
      tokenSource: dependencies.resetTokenSource,
    }),
    mailbox,
    products: createProductService(products),
    carts: createCartService(carts, mixes),
    promos: createPromoService({ promos, carts, mixes, clock }),
    orders: createOrderService(orders),
    checkout: createCheckoutService({
      unitOfWork: createUnitOfWork(dependencies.db),
      carts,
      promos,
      payments: createPaymentRepository(dependencies.db),
      orders,
      mailbox,
      gateway: simulatedPaymentGateway,
      clock,
      mixes,
      products,
    }),
    favourites: createFavouritesService(createFavouritesRepository(dependencies.db)),
    powderizer: createPowderizerService({
      unitOfWork: createUnitOfWork(dependencies.db),
      carts,
      products,
      mixes,
    }),
  };
}

/** Build the HTTP application. The caller owns database lifecycle and listening. */
export async function buildApp(dependencies: AppDependencies) {
  const app = Fastify({ logger: true }).withTypeProvider<TypeBoxTypeProvider>();
  const context: AppContext = { services: createAppServices(dependencies) };

  app.setErrorHandler((error: FastifyError, _request, reply) => {
    if (error.validation) {
      reply.code(400).send({
        error: error.message,
        details: error.validation instanceof Array ? error.validation : undefined,
      });
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

  app.get('/health', () => ({ status: 'ok' }));

  await app.register(fastifyCookie);
  authPlugin(context.services.sessions)(app, {}, () => undefined);
  await app.register(productsRoutes, context);
  await app.register(cartRoutes, context);
  await app.register(promoRoutes, context);
  await app.register(ordersRoutes, context);
  await app.register(authRoutes, context);
  await app.register(favouritesRoutes, context);
  await app.register(paymentRoutes, context);
  await app.register(mailboxRoutes, context);
  await app.register(powderizerRoutes, context);

  return app;
}
