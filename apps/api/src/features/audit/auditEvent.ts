const textEncoder = new TextEncoder();

export const AUDIT_ACTIONS = [
  'auth.user_signed_up',
  'auth.session_created',
  'auth.session_destroyed',
  'auth.password_changed',
  'auth.password_reset_requested',
  'auth.password_reset_completed',
  'cart.created',
  'cart.product_added',
  'cart.product_quantity_changed',
  'cart.product_removed',
  'cart.bundle_added',
  'checkout.cart_consumed',
  'payment.pre_gateway_failed',
  'payment.declined',
  'payment.timed_out',
  'payment.succeeded',
  'order.created',
  'order.shipment_packed',
  'order.cancelled',
  'shipment.transitioned',
  'shipment.tracking_updated',
  'review.created',
  'review.updated',
  'review.deleted',
  'review.hidden',
  'review.restored',
  'review.helpful_added',
  'review.helpful_removed',
  'review.report_created',
  'review.report_withdrawn',
  'review.reports_dismissed',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];
export type AuditEntityType = 'user' | 'cart' | 'payment' | 'order' | 'shipment' | 'review';
export type AuditActor =
  | { type: 'anonymous'; userId: null }
  | { type: 'user'; userId: number }
  | { type: 'system'; userId: null };

/** Request-scoped facts that are safe to retain with a domain mutation. */
export interface AuditContext {
  actor: AuditActor;
  requestId: string | null;
}

export const PRE_GATEWAY_FAILURE_CODES = [
  'CART_NOT_FOUND',
  'CART_EMPTY',
  'PROMO_INVALID',
  'CARD_INVALID',
  'MIX_REQUOTE_REQUIRED',
  'MIX_STOCK_UNAVAILABLE',
  'CHECKOUT_FAILED',
] as const;

export type PreGatewayFailureCode = (typeof PRE_GATEWAY_FAILURE_CODES)[number];

type WithContext = { context: AuditContext };
type UserEventAction = Exclude<
  AuditAction,
  | `cart.${string}`
  | `checkout.${string}`
  | `payment.${string}`
  | `order.${string}`
  | `shipment.${string}`
  | `review.${string}`
>;

export type AuditEventInput =
  | (WithContext & { action: 'auth.user_signed_up'; userId: number })
  | (WithContext & { action: 'auth.session_created'; userId: number; source: 'signup' | 'login' })
  | (WithContext & {
      action: Exclude<UserEventAction, 'auth.user_signed_up' | 'auth.session_created'>;
      userId: number;
    })
  | (WithContext & { action: 'cart.created'; cartId: string })
  | (WithContext & {
      action: 'cart.product_added' | 'cart.product_quantity_changed';
      cartId: string;
      productId: number;
      quantity: number;
    })
  | (WithContext & { action: 'cart.product_removed'; cartId: string; productId: number })
  | (WithContext & {
      action: 'cart.bundle_added';
      cartId: string;
      bundleId: number;
      componentCount: number;
      quantity: number;
    })
  | (WithContext & { action: 'checkout.cart_consumed'; cartId: string })
  | (WithContext & {
      action: 'payment.pre_gateway_failed';
      paymentId: number;
      errorCode: PreGatewayFailureCode;
    })
  | (WithContext & { action: 'payment.declined' | 'payment.timed_out'; paymentId: number })
  | (WithContext & {
      action: 'payment.succeeded';
      paymentId: number;
      orderId: number;
      amountCents: number;
    })
  | (WithContext & {
      action: 'order.created';
      orderId: number;
      totalCents: number;
      itemCount: number;
      mixItemCount: number;
    })
  | (WithContext & { action: 'order.shipment_packed'; orderId: number; shipmentCount: number })
  | (WithContext & { action: 'order.cancelled'; orderId: number })
  | (WithContext & {
      action: 'shipment.transitioned';
      shipmentId: number;
      orderId: number;
      status: 'shipped' | 'delivered' | 'delivery_failed';
    })
  | (WithContext & { action: 'shipment.tracking_updated'; shipmentId: number; orderId: number })
  | (WithContext & {
      action: 'review.created' | 'review.updated';
      reviewId: number;
      productId: number;
      rating: number;
    })
  | (WithContext & {
      action: 'review.deleted' | 'review.hidden' | 'review.restored';
      reviewId: number;
      productId: number;
    })
  | (WithContext & {
      action: 'review.helpful_added' | 'review.helpful_removed' | 'review.report_withdrawn';
      reviewId: number;
      productId: number;
    })
  | (WithContext & {
      action: 'review.report_created';
      reviewId: number;
      productId: number;
      reason: 'spam' | 'harassment' | 'unsafe' | 'off_topic' | 'other';
    })
  | (WithContext & {
      action: 'review.reports_dismissed';
      reviewId: number;
      productId: number;
      resolvedReportCount: number;
    });

export interface BuiltAuditEvent {
  actorType: AuditActor['type'];
  actorUserId: number | null;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  requestId: string | null;
  metadata: Readonly<Record<string, string | number>>;
  metadataJson: string;
}

export class AuditEventValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuditEventValidationError';
  }
}

const auditActionSet = new Set<string>(AUDIT_ACTIONS);
const preGatewayFailureCodeSet = new Set<string>(PRE_GATEWAY_FAILURE_CODES);
const MAX_METADATA_BYTES = 2_048;
const MAX_ENTITY_ID_LENGTH = 255;
const MAX_REQUEST_ID_LENGTH = 255;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requirePositiveSafeInteger(value: unknown, name: string): number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    throw new AuditEventValidationError(`${name} must be a positive safe integer`);
  }
  return value as number;
}

function requireNonNegativeSafeInteger(value: unknown, name: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new AuditEventValidationError(`${name} must be a non-negative safe integer`);
  }
  return value as number;
}

function requireBoundedString(value: unknown, name: string, maxLength: number): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > maxLength) {
    throw new AuditEventValidationError(
      `${name} must be a non-empty string of at most ${maxLength} characters`,
    );
  }
  return value;
}

function requireContext(value: unknown): AuditContext {
  if (!isRecord(value) || !isRecord(value.actor)) {
    throw new AuditEventValidationError('context must include a valid actor');
  }
  const { actor, requestId } = value;
  if (actor.type === 'user') {
    requirePositiveSafeInteger(actor.userId, 'actor.userId');
  } else if ((actor.type !== 'anonymous' && actor.type !== 'system') || actor.userId !== null) {
    throw new AuditEventValidationError(
      'actor must be anonymous, user, or system with a valid userId shape',
    );
  }
  if (requestId !== null) requireBoundedString(requestId, 'requestId', MAX_REQUEST_ID_LENGTH);
  if (actor.type !== 'system' && requestId === null) {
    throw new AuditEventValidationError('requestId is required for anonymous and user actors');
  }
  return { actor: actor as AuditActor, requestId: requestId as string | null };
}

function serializeMetadata(metadata: Record<string, string | number>): string {
  const json = JSON.stringify(metadata);
  if (textEncoder.encode(json).byteLength > MAX_METADATA_BYTES) {
    throw new AuditEventValidationError(
      `metadata must not exceed ${MAX_METADATA_BYTES} UTF-8 bytes`,
    );
  }
  return json;
}

function userEntity(input: Record<string, unknown>): { entityType: 'user'; entityId: string } {
  return {
    entityType: 'user',
    entityId: String(requirePositiveSafeInteger(input.userId, 'userId')),
  };
}

function cartEntity(input: Record<string, unknown>): { entityType: 'cart'; entityId: string } {
  return {
    entityType: 'cart',
    entityId: requireBoundedString(input.cartId, 'cartId', MAX_ENTITY_ID_LENGTH),
  };
}

function paymentEntity(input: Record<string, unknown>): {
  entityType: 'payment';
  entityId: string;
} {
  return {
    entityType: 'payment',
    entityId: String(requirePositiveSafeInteger(input.paymentId, 'paymentId')),
  };
}

function orderEntity(input: Record<string, unknown>): { entityType: 'order'; entityId: string } {
  return {
    entityType: 'order',
    entityId: String(requirePositiveSafeInteger(input.orderId, 'orderId')),
  };
}

function shipmentEntity(input: Record<string, unknown>): {
  entityType: 'shipment';
  entityId: string;
} {
  return {
    entityType: 'shipment',
    entityId: String(requirePositiveSafeInteger(input.shipmentId, 'shipmentId')),
  };
}

function reviewEntity(input: Record<string, unknown>): { entityType: 'review'; entityId: string } {
  return {
    entityType: 'review',
    entityId: String(requirePositiveSafeInteger(input.reviewId, 'reviewId')),
  };
}

function requireReviewRating(value: unknown): number {
  const rating = requirePositiveSafeInteger(value, 'rating');
  if (rating > 5) throw new AuditEventValidationError('rating must be an integer between 1 and 5');
  return rating;
}

/** Builds one immutable, privacy-allowlisted audit row from scalar domain facts. */
export function buildAuditEvent(input: AuditEventInput): BuiltAuditEvent {
  if (!isRecord(input) || !auditActionSet.has(input.action)) {
    throw new AuditEventValidationError('action is not an allowed audit action');
  }
  const context = requireContext(input.context);
  let entity: { entityType: AuditEntityType; entityId: string };
  let metadata: Record<string, string | number>;

  switch (input.action) {
    case 'auth.user_signed_up':
    case 'auth.session_destroyed':
    case 'auth.password_changed':
    case 'auth.password_reset_requested':
    case 'auth.password_reset_completed':
      entity = userEntity(input);
      metadata = {};
      break;
    case 'auth.session_created':
      entity = userEntity(input);
      if (input.source !== 'signup' && input.source !== 'login') {
        throw new AuditEventValidationError('source must be signup or login');
      }
      metadata = { source: input.source };
      break;
    case 'cart.created':
    case 'checkout.cart_consumed':
      entity = cartEntity(input);
      metadata = {};
      break;
    case 'cart.product_added':
    case 'cart.product_quantity_changed':
      entity = cartEntity(input);
      metadata = {
        productId: requirePositiveSafeInteger(input.productId, 'productId'),
        quantity: requirePositiveSafeInteger(input.quantity, 'quantity'),
      };
      break;
    case 'cart.product_removed':
      entity = cartEntity(input);
      metadata = { productId: requirePositiveSafeInteger(input.productId, 'productId') };
      break;
    case 'cart.bundle_added':
      entity = cartEntity(input);
      metadata = {
        bundleId: requirePositiveSafeInteger(input.bundleId, 'bundleId'),
        componentCount: requirePositiveSafeInteger(input.componentCount, 'componentCount'),
        quantity: requirePositiveSafeInteger(input.quantity, 'quantity'),
      };
      break;
    case 'payment.pre_gateway_failed':
      entity = paymentEntity(input);
      if (!preGatewayFailureCodeSet.has(input.errorCode)) {
        throw new AuditEventValidationError('errorCode is not an allowed pre-gateway failure code');
      }
      metadata = { errorCode: input.errorCode };
      break;
    case 'payment.declined':
    case 'payment.timed_out':
      entity = paymentEntity(input);
      metadata = {};
      break;
    case 'payment.succeeded':
      entity = paymentEntity(input);
      metadata = {
        orderId: requirePositiveSafeInteger(input.orderId, 'orderId'),
        amountCents: requireNonNegativeSafeInteger(input.amountCents, 'amountCents'),
      };
      break;
    case 'order.created':
      entity = orderEntity(input);
      metadata = {
        totalCents: requireNonNegativeSafeInteger(input.totalCents, 'totalCents'),
        itemCount: requireNonNegativeSafeInteger(input.itemCount, 'itemCount'),
        mixItemCount: requireNonNegativeSafeInteger(input.mixItemCount, 'mixItemCount'),
      };
      break;
    case 'order.shipment_packed':
      entity = orderEntity(input);
      metadata = {
        shipmentCount: requirePositiveSafeInteger(input.shipmentCount, 'shipmentCount'),
      };
      break;
    case 'order.cancelled':
      entity = orderEntity(input);
      metadata = {};
      break;
    case 'shipment.transitioned':
      entity = shipmentEntity(input);
      if (!['shipped', 'delivered', 'delivery_failed'].includes(input.status)) {
        throw new AuditEventValidationError('status is not an allowed shipment status');
      }
      metadata = {
        orderId: requirePositiveSafeInteger(input.orderId, 'orderId'),
        status: input.status,
      };
      break;
    case 'shipment.tracking_updated':
      entity = shipmentEntity(input);
      metadata = { orderId: requirePositiveSafeInteger(input.orderId, 'orderId') };
      break;
    case 'review.created':
    case 'review.updated':
      entity = reviewEntity(input);
      metadata = {
        productId: requirePositiveSafeInteger(input.productId, 'productId'),
        rating: requireReviewRating(input.rating),
      };
      break;
    case 'review.deleted':
    case 'review.hidden':
    case 'review.restored':
    case 'review.helpful_added':
    case 'review.helpful_removed':
    case 'review.report_withdrawn':
      entity = reviewEntity(input);
      metadata = { productId: requirePositiveSafeInteger(input.productId, 'productId') };
      break;
    case 'review.report_created':
      entity = reviewEntity(input);
      if (!['spam', 'harassment', 'unsafe', 'off_topic', 'other'].includes(input.reason)) {
        throw new AuditEventValidationError('reason is not an allowed review report reason');
      }
      metadata = {
        productId: requirePositiveSafeInteger(input.productId, 'productId'),
        reason: input.reason,
      };
      break;
    case 'review.reports_dismissed':
      entity = reviewEntity(input);
      metadata = {
        productId: requirePositiveSafeInteger(input.productId, 'productId'),
        resolvedReportCount: requireNonNegativeSafeInteger(
          input.resolvedReportCount,
          'resolvedReportCount',
        ),
      };
      break;
  }

  const metadataJson = serializeMetadata(metadata);
  return Object.freeze({
    actorType: context.actor.type,
    actorUserId: context.actor.userId,
    action: input.action,
    entityType: entity.entityType,
    entityId: entity.entityId,
    requestId: context.requestId,
    metadata: Object.freeze({ ...metadata }),
    metadataJson,
  });
}
