import {
  CreateReviewBody,
  OwnedReviewResponse,
  ReviewIdParam,
  ReviewListQuery,
  ReviewListResponse,
  ReviewMutationResponse,
  ReviewProductParam,
  UpdateReviewBody,
} from '@shop/contracts/reviews';
import { ErrorResponse, SuccessResponse } from '@shop/contracts/common';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { FastifyInstance } from 'fastify';
import { ReviewServiceError, type ReviewService } from '../features/reviews/reviewService.js';
import type { AuditContext } from '../features/audit/auditEvent.js';
import { requireAdmin, requireAuth, requireCustomer } from '../plugins/auth.js';
import type { SessionService } from '../features/auth/sessionService.js';
import { sendBadRequest, sendConflict, sendForbidden, sendNotFound } from '../utils/errors.js';

export interface ReviewRouteServices {
  sessions: SessionService;
  reviews: ReviewService;
}

function sendReviewError(
  reply: Parameters<typeof sendBadRequest>[0],
  error: ReviewServiceError,
): void {
  switch (error.code) {
    case 'INVALID_INPUT':
      sendBadRequest(reply, error.message);
      return;
    case 'FORBIDDEN':
      sendForbidden(reply);
      return;
    case 'NOT_FOUND':
      sendNotFound(reply, 'Review');
      return;
    case 'DUPLICATE':
    case 'INVALID_TRANSITION':
      sendConflict(reply, error.message);
      return;
  }
}

/** Public review reads plus customer ownership and admin moderation endpoints. */
export default function reviewsRoutes(
  app: FastifyInstance,
  { services }: { services: ReviewRouteServices },
): void {
  const typed = app.withTypeProvider<TypeBoxTypeProvider>();
  const contextFor = (userId: number, requestId: string): AuditContext => ({
    actor: { type: 'user', userId },
    requestId,
  });

  typed.get(
    '/api/products/:productId/reviews',
    {
      schema: {
        params: ReviewProductParam,
        querystring: ReviewListQuery,
        response: { 200: ReviewListResponse, 400: ErrorResponse, 404: ErrorResponse },
      },
    },
    (request, reply) => {
      try {
        return services.reviews.listProduct(Number(request.params.productId), request.query);
      } catch (error) {
        if (error instanceof ReviewServiceError) {
          sendReviewError(reply, error);
          return;
        }
        throw error;
      }
    },
  );

  typed.get(
    '/api/products/:productId/reviews/me',
    {
      preHandler: [requireAuth(services.sessions)],
      schema: {
        params: ReviewProductParam,
        response: { 200: OwnedReviewResponse, 401: ErrorResponse, 404: ErrorResponse },
      },
    },
    (request, reply) => {
      try {
        return services.reviews.findOwned(
          request.authenticatedUser!.id,
          Number(request.params.productId),
        );
      } catch (error) {
        if (error instanceof ReviewServiceError) {
          sendReviewError(reply, error);
          return;
        }
        throw error;
      }
    },
  );

  typed.post(
    '/api/products/:productId/reviews',
    {
      preHandler: [requireCustomer(services.sessions)],
      schema: {
        params: ReviewProductParam,
        body: CreateReviewBody,
        response: {
          201: ReviewMutationResponse,
          400: ErrorResponse,
          401: ErrorResponse,
          403: ErrorResponse,
          404: ErrorResponse,
          409: ErrorResponse,
        },
      },
    },
    (request, reply) => {
      try {
        reply.code(201);
        return services.reviews.create(
          request.authenticatedUser!.id,
          Number(request.params.productId),
          request.body,
          contextFor(request.authenticatedUser!.id, request.id),
        );
      } catch (error) {
        if (error instanceof ReviewServiceError) {
          sendReviewError(reply, error);
          return;
        }
        throw error;
      }
    },
  );

  typed.patch(
    '/api/reviews/:reviewId',
    {
      preHandler: [requireCustomer(services.sessions)],
      schema: {
        params: ReviewIdParam,
        body: UpdateReviewBody,
        response: {
          200: ReviewMutationResponse,
          400: ErrorResponse,
          401: ErrorResponse,
          403: ErrorResponse,
          404: ErrorResponse,
        },
      },
    },
    (request, reply) => {
      try {
        return services.reviews.update(
          request.authenticatedUser!.id,
          Number(request.params.reviewId),
          request.body,
          contextFor(request.authenticatedUser!.id, request.id),
        );
      } catch (error) {
        if (error instanceof ReviewServiceError) {
          sendReviewError(reply, error);
          return;
        }
        throw error;
      }
    },
  );

  typed.delete(
    '/api/reviews/:reviewId',
    {
      preHandler: [requireCustomer(services.sessions)],
      schema: {
        params: ReviewIdParam,
        response: {
          200: SuccessResponse,
          401: ErrorResponse,
          403: ErrorResponse,
          404: ErrorResponse,
        },
      },
    },
    (request, reply) => {
      try {
        services.reviews.delete(
          request.authenticatedUser!.id,
          Number(request.params.reviewId),
          contextFor(request.authenticatedUser!.id, request.id),
        );
        return { success: true as const };
      } catch (error) {
        if (error instanceof ReviewServiceError) {
          sendReviewError(reply, error);
          return;
        }
        throw error;
      }
    },
  );

  for (const [action, handler] of [
    ['hide', (reviewId: number, context: AuditContext) => services.reviews.hide(reviewId, context)],
    [
      'restore',
      (reviewId: number, context: AuditContext) => services.reviews.restore(reviewId, context),
    ],
  ] as const) {
    typed.post(
      `/api/admin/reviews/:reviewId/${action}`,
      {
        preHandler: [requireAdmin(services.sessions)],
        schema: {
          params: ReviewIdParam,
          response: {
            200: ReviewMutationResponse,
            401: ErrorResponse,
            403: ErrorResponse,
            404: ErrorResponse,
            409: ErrorResponse,
          },
        },
      },
      (request, reply) => {
        try {
          return handler(
            Number(request.params.reviewId),
            contextFor(request.authenticatedUser!.id, request.id),
          );
        } catch (error) {
          if (error instanceof ReviewServiceError) {
            sendReviewError(reply, error);
            return;
          }
          throw error;
        }
      },
    );
  }
}
