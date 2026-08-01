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
import paymentRoutes from './routes/payments.js';
import mailboxRoutes from './routes/mailbox.js';
import bundleRoutes from './routes/bundles.js';
import reorderRoutes from './routes/reorder.js';
import { createAuthService, type AuthService, type Clock } from './features/auth/authService.js';
import { createSessionRepository } from './features/auth/sessionRepository.js';
import { createSessionService, type SessionService } from './features/auth/sessionService.js';
import { createUserRepository } from './features/auth/userRepository.js';
import { createProductRepository } from './features/catalog/productRepository.js';
import { createProductService, type ProductService } from './features/catalog/productService.js';
import { createCartRepository } from './features/cart/cartRepository.js';
import { createCartService, type CartService } from './features/cart/cartService.js';
import { createOrderRepository } from './features/orders/orderRepository.js';
import { createOrderService, type OrderService } from './features/orders/orderService.js';
import {
  createOrderAccessService,
  type OrderAccessService,
  type OrderAccessTokenSource,
} from './features/orders/orderAccessService.js';
import {
  createCheckoutService,
  type CheckoutService,
} from './features/checkout/checkoutService.js';
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
import { createUnitOfWork, type UnitOfWork } from './db/unitOfWork.js';
import { createAuditRepository } from './features/audit/auditRepository.js';
import {
  createAuditReadService,
  createAuditWriter,
  type AuditReadService,
} from './features/audit/auditService.js';
import auditRoutes from './routes/audit.js';
import { createBundleRepository } from './features/bundles/bundleRepository.js';
import { createBundleService, type BundleService } from './features/bundles/bundleService.js';
import reviewsRoutes from './routes/reviews.js';
import returnsRoutes from './routes/returns.js';
import adminReturnsRoutes from './routes/adminReturns.js';
import { createReviewRepository } from './features/reviews/reviewRepository.js';
import { createReviewService, type ReviewService } from './features/reviews/reviewService.js';
import adminOrdersRoutes from './routes/adminOrders.js';
import adminInventoryRoutes from './routes/adminInventory.js';
import { createInventoryRepository } from './features/inventory/inventoryRepository.js';
import {
  createInventoryService,
  type InventoryService,
} from './features/inventory/inventoryService.js';
import type { ReturnService } from './features/returns/returnService.js';
import { createReturnRepository } from './features/returns/returnRepository.js';
import { createReturnService } from './features/returns/returnService.js';
import { createRefundGateway } from './features/returns/refundGateway.js';
import { createCustomBlendRepository } from './features/customBlend/customBlendRepository.js';
import {
  createCustomBlendService,
  type CustomBlendService,
} from './features/customBlend/customBlendService.js';
import customBlendRoutes from './routes/customBlends.js';
import tradeAccountRoutes from './routes/tradeAccount.js';
import deliverySlotRoutes from './routes/deliverySlots.js';
import adminProductsRoutes from './routes/adminProducts.js';
import adminVariantsRoutes from './routes/adminVariants.js';
import adminPromosRoutes from './routes/adminPromos.js';
import adminUsersRoutes from './routes/adminUsers.js';
import adminOrdersListRoutes from './routes/adminOrdersList.js';
import adminRefundsRoutes from './routes/adminRefunds.js';
import adminFeatureFlagsRoutes from './routes/adminFeatureFlags.js';
import { createDeliverySiteRepository } from './features/tradeAccount/deliverySiteRepository.js';
import {
  createDeliverySiteService,
  type DeliverySiteService,
} from './features/tradeAccount/deliverySiteService.js';
import { createBillingEntityRepository } from './features/tradeAccount/billingEntityRepository.js';
import {
  createBillingEntityService,
  type BillingEntityService,
} from './features/tradeAccount/billingEntityService.js';
import {
  createDeliverySlotService,
  type DeliverySlotService,
} from './features/delivery/deliverySlotService.js';
import accountSessionRoutes from './routes/accountSessions.js';
import accountPreferencesRoutes from './routes/accountPreferences.js';
import accountExportRoutes from './routes/accountExport.js';
import accountDeletionRoutes from './routes/accountDeletion.js';
import companyAccountRoutes from './routes/companyAccounts.js';
import orderApprovalRoutes from './routes/orderApprovals.js';
import { createPreferencesRepository } from './features/preferences/preferencesRepository.js';
import {
  createPreferencesService,
  type PreferencesService,
} from './features/preferences/preferencesService.js';
import {
  createDataExportService,
  type DataExportService,
} from './features/accountExport/dataExportService.js';
import { createAccountDeletionRepository } from './features/accountDeletion/deletionRepository.js';
import {
  createAccountDeletionService,
  type AccountDeletionService,
} from './features/accountDeletion/deletionService.js';
import { createCompanyRepository } from './features/companyAccounts/companyRepository.js';
import { createCompanyMembershipRepository } from './features/companyAccounts/companyMembershipRepository.js';
import { createCompanyInviteRepository } from './features/companyAccounts/companyInviteRepository.js';
import {
  createCompanyService,
  type CompanyService,
} from './features/companyAccounts/companyService.js';
import { createApprovalRepository } from './features/orderApprovals/approvalRepository.js';
import {
  createApprovalService,
  type ApprovalService,
} from './features/orderApprovals/approvalService.js';
import {
  createProductAdminService,
  type ProductAdminService,
} from './features/catalog/productAdminService.js';
import { createProductAdminRepository } from './features/catalog/productAdminRepository.js';
import {
  createVariantAdminService,
  type VariantAdminService,
} from './features/catalog/variantAdminService.js';
import { createVariantAdminRepository } from './features/catalog/variantAdminRepository.js';
import {
  createPromoAdminService,
  type PromoAdminService,
} from './features/promos/promoAdminService.js';
import { createPromoAdminRepository } from './features/promos/promoAdminRepository.js';
import { createUserAdminService, type UserAdminService } from './features/auth/userAdminService.js';
import { createUserAdminRepository } from './features/auth/userAdminRepository.js';
import {
  createOrderAdminService,
  type OrderAdminService,
} from './features/orders/orderAdminService.js';
import { createOrderAdminRepository } from './features/orders/orderAdminRepository.js';
import {
  createAdminRefundService,
  type AdminRefundService,
} from './features/payments/adminRefundService.js';
import {
  createFeatureFlagService,
  type FeatureFlagService,
} from './features/featureFlags/featureFlagService.js';
import { createFeatureFlagRepository } from './features/featureFlags/featureFlagRepository.js';
import { createFeatureFlagResolver } from './features/featureFlags/featureFlagResolver.js';
import { createReorderService, type ReorderService } from './features/reorder/reorderService.js';
import {
  createQuickOrderService,
  type QuickOrderService,
} from './features/quickOrder/quickOrderService.js';
import quickOrderRoutes from './routes/quickOrder.js';
import savedListRoutes from './routes/savedLists.js';
import {
  createSavedListService,
  type SavedListService,
} from './features/savedLists/savedListService.js';
import { createSavedListRepository } from './features/savedLists/savedListRepository.js';

/**
 * The buyer's saved trade records, grouped because they are always wired, injected, and consumed
 * as one account surface (routes and checkout both need both halves).
 */
export interface TradeAccountServices {
  sites: DeliverySiteService;
  billingEntities: BillingEntityService;
}

export interface AppDependencies {
  db: Database.Database;
  resetBaseUrl: string;
  clock?: Clock;
  resetTokenSource?: ResetTokenSource;
  orderAccessTokenSource?: OrderAccessTokenSource;
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
  orderAccess: OrderAccessService;
  checkout: CheckoutService;
  audit: AuditReadService;
  bundles: BundleService;
  reorder: ReorderService;
  quickOrder: QuickOrderService;
  savedLists: SavedListService;
  reviews: ReviewService;
  inventory: InventoryService;
  inventoryUnitOfWork: UnitOfWork;
  returns: ReturnService;
  customBlends: CustomBlendService;
  tradeAccount: TradeAccountServices;
  deliverySlots: DeliverySlotService;
  preferences: PreferencesService;
  dataExport: DataExportService;
  accountDeletion: AccountDeletionService;
  companyAccounts: CompanyService;
  approvals: ApprovalService;
  productAdmin: ProductAdminService;
  variantAdmin: VariantAdminService;
  promoAdmin: PromoAdminService;
  userAdmin: UserAdminService;
  orderAdmin: OrderAdminService;
  adminRefunds: AdminRefundService;
  featureFlags: FeatureFlagService;
  clock: Clock;
}

export type AppContext = { services: AppServices };

function createAppServices(dependencies: AppDependencies): AppServices {
  const clock = dependencies.clock ?? { now: () => new Date() };
  const mailbox = createMailboxRepository(dependencies.db);
  const carts = createCartRepository(dependencies.db);
  const promos = createPromoRepository(dependencies.db);
  const orders = createOrderRepository(dependencies.db);
  const products = createProductRepository(dependencies.db);
  const sessionRepository = createSessionRepository(dependencies.db);
  const featureFlagRepository = createFeatureFlagRepository(dependencies.db);
  const unitOfWork = createUnitOfWork(dependencies.db);
  const inventory = createInventoryService({
    repository: createInventoryRepository(dependencies.db),
  });
  const auditRepository = createAuditRepository(dependencies.db);
  const audit = createAuditWriter({ repository: auditRepository, clock });
  const users = createUserRepository(dependencies.db);
  const sessions = createSessionService({
    sessions: sessionRepository,
    clock,
    unitOfWork,
    audit,
  });
  const preferences = createPreferencesService({
    repository: createPreferencesRepository(dependencies.db),
    unitOfWork,
    audit,
    clock,
  });
  // Hoisted: the slot service reads carts through the same cart service the routes use, so the
  // slot quote can never see a different view of a cart than the cart endpoints do.
  const cartService = createCartService(carts, { unitOfWork, audit }, { inventory, clock });
  // Hoisted: checkout resolves saved destinations and re-validates slots through the very same
  // service instances the account and slot routes answer from, so no second view can exist.
  const tradeAccount: TradeAccountServices = {
    sites: createDeliverySiteService({
      repository: createDeliverySiteRepository(dependencies.db),
      unitOfWork,
      clock,
    }),
    billingEntities: createBillingEntityService({
      repository: createBillingEntityRepository(dependencies.db),
      unitOfWork,
      clock,
    }),
  };
  const deliverySlots = createDeliverySlotService({ cart: cartService, clock });
  // Hoisted: reorder reads owned orders through the very same order service the order endpoints
  // answer from, so ownership can never be decided against a second view of an order.
  const orderService = createOrderService({
    repository: orders,
    unitOfWork,
    clock,
    audit,
    inventory,
  });
  const companyAccounts = createCompanyService({
    companies: createCompanyRepository(dependencies.db),
    memberships: createCompanyMembershipRepository(dependencies.db),
    invites: createCompanyInviteRepository(dependencies.db),
    mailbox,
    unitOfWork,
    audit,
    clock,
    baseUrl: dependencies.resetBaseUrl,
  });
  const approvals = createApprovalService({
    approvals: createApprovalRepository(dependencies.db),
    companies: companyAccounts,
    mailbox,
    unitOfWork,
    audit,
    clock,
  });
  const savedLists = createSavedListService({
    repository: createSavedListRepository(dependencies.db),
    variants: products,
    inventory,
    carts: cartService,
    orders: orderService,
    unitOfWork,
    audit,
    clock,
  });
  const dataExport = createDataExportService({
    unitOfWork,
    audit,
    clock,
    sessions,
    orders,
    savedLists,
    deliverySites: createDeliverySiteRepository(dependencies.db),
    billingEntities: createBillingEntityRepository(dependencies.db),
    preferences,
    mailbox,
  });
  const accountDeletion = createAccountDeletionService({
    users,
    repository: createAccountDeletionRepository(dependencies.db),
    unitOfWork,
    audit,
    clock,
  });
  return {
    auth: createAuthService({
      users,
      clock,
      unitOfWork,
      audit,
    }),
    sessions,
    passwordReset: createPasswordResetService({
      repository: createPasswordResetRepository(dependencies.db),
      mailbox,
      clock,
      baseUrl: dependencies.resetBaseUrl,
      tokenSource: dependencies.resetTokenSource,
      unitOfWork,
      audit,
    }),
    mailbox,
    products: createProductService(products, { clock }),
    carts: cartService,
    promos: createPromoService({ promos, carts, clock }),
    orders: orderService,
    orderAccess: createOrderAccessService({
      repository: orders,
      clock,
      tokenSource: dependencies.orderAccessTokenSource,
    }),
    checkout: createCheckoutService({
      unitOfWork,
      carts,
      promos,
      payments: createPaymentRepository(dependencies.db),
      orders,
      mailbox,
      gateway: simulatedPaymentGateway,
      clock,
      products,
      audit,
      inventory,
      approvals,
      companies: companyAccounts,
      tradeAccount,
      deliverySlots,
    }),
    bundles: createBundleService({
      bundles: createBundleRepository(dependencies.db),
      carts,
      unitOfWork,
      audit,
      availability: { inventory, clock },
    }),
    // Shares the cart service's own `unitOfWork`, so the reorder transaction nests over the bulk
    // add's transaction as a savepoint instead of opening a second, competing one.
    reorder: createReorderService({
      orders: orderService,
      carts: cartService,
      variants: products,
      unitOfWork,
      audit,
      clock,
    }),
    quickOrder: createQuickOrderService({
      carts: cartService,
      variants: products,
      unitOfWork,
      audit,
    }),
    savedLists,
    reviews: createReviewService({
      repository: createReviewRepository(dependencies.db),
      unitOfWork,
      audit,
      clock,
    }),
    inventory,
    inventoryUnitOfWork: unitOfWork,
    returns: createReturnService({
      returnRepository: createReturnRepository(dependencies.db),
      orderRepository: orders,
      unitOfWork,
      clock,
      audit,
      inventory,
      refundGateway: createRefundGateway(),
      resolveVariantId: (orderLineItemId: number) => {
        const row = dependencies.db
          .prepare('SELECT variant_id FROM order_line_items WHERE id = ?')
          .get(orderLineItemId) as { variant_id: number | null } | undefined;
        return row?.variant_id ?? undefined;
      },
    }),
    customBlends: createCustomBlendService(createCustomBlendRepository(dependencies.db)),
    tradeAccount,
    deliverySlots,
    preferences,
    dataExport,
    accountDeletion,
    companyAccounts,
    approvals,
    productAdmin: createProductAdminService({
      repository: createProductAdminRepository(dependencies.db),
      unitOfWork,
      audit,
      clock,
    }),
    variantAdmin: createVariantAdminService({
      repository: createVariantAdminRepository(dependencies.db),
      unitOfWork,
      audit,
      clock,
    }),
    promoAdmin: createPromoAdminService({
      repository: createPromoAdminRepository(dependencies.db),
      unitOfWork,
      audit,
    }),
    userAdmin: createUserAdminService({
      repository: createUserAdminRepository(dependencies.db),
      sessions: sessionRepository,
      unitOfWork,
      audit,
      clock,
    }),
    orderAdmin: createOrderAdminService({
      repository: createOrderAdminRepository(dependencies.db),
      orderRepository: orders,
    }),
    adminRefunds: createAdminRefundService({
      db: dependencies.db,
      unitOfWork,
      audit,
      clock,
      refundGateway: createRefundGateway(),
    }),
    featureFlags: createFeatureFlagService({
      repository: featureFlagRepository,
      resolver: createFeatureFlagResolver(featureFlagRepository),
      unitOfWork,
      audit,
    }),
    clock,
    audit: createAuditReadService(auditRepository),
  };
}

/** Build the HTTP application. The caller owns database lifecycle and listening. */
export async function buildApp(dependencies: AppDependencies) {
  const app = Fastify({
    logger: false,
    ajv: { customOptions: { removeAdditional: false } },
  }).withTypeProvider<TypeBoxTypeProvider>();
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
  await app.register(adminOrdersRoutes, context);
  await app.register(adminInventoryRoutes, context);
  await app.register(adminProductsRoutes, context);
  await app.register(adminVariantsRoutes, context);
  await app.register(adminPromosRoutes, context);
  await app.register(adminUsersRoutes, context);
  await app.register(adminOrdersListRoutes, context);
  await app.register(adminRefundsRoutes, context);
  await app.register(adminFeatureFlagsRoutes, context);
  await app.register(authRoutes, context);
  await app.register(paymentRoutes, context);
  await app.register(mailboxRoutes, context);
  await app.register(bundleRoutes, context);
  await app.register(reorderRoutes, context);
  await app.register(quickOrderRoutes, context);
  await app.register(savedListRoutes, context);
  await app.register(auditRoutes, context);
  await app.register(reviewsRoutes, context);
  await app.register(returnsRoutes, context);
  await app.register(adminReturnsRoutes, context);
  await app.register(customBlendRoutes, context);
  await app.register(tradeAccountRoutes, context);
  await app.register(deliverySlotRoutes, context);
  await app.register(accountSessionRoutes, context);
  await app.register(accountPreferencesRoutes, context);
  await app.register(accountExportRoutes, context);
  await app.register(accountDeletionRoutes, context);
  await app.register(companyAccountRoutes, context);
  await app.register(orderApprovalRoutes, context);

  return app;
}
