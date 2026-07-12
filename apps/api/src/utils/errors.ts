import { FastifyReply } from 'fastify';

/** Send a structured error response with consistent shape. */
export function sendError(
  reply: FastifyReply,
  statusCode: number,
  message: string,
  details?: unknown,
): void {
  reply.code(statusCode).send({ error: message, details });
}

/** Shorthand for 400 bad-request errors. */
export function sendBadRequest(reply: FastifyReply, message: string, details?: unknown): void {
  sendError(reply, 400, message, details);
}

/** Shorthand for 401 unauthorized errors. */
export function sendUnauthorized(reply: FastifyReply, message = 'Unauthorized'): void {
  sendError(reply, 401, message);
}

/** Shorthand for 402 payment-required errors. */
export function sendPaymentError(
  reply: FastifyReply,
  message: string,
  failureReason?: 'CARD_DECLINED' | 'GATEWAY_TIMEOUT',
): void {
  reply.code(402).send({ error: message, failureReason });
}

/** Shorthand for 404 resource-not-found errors. */
export function sendNotFound(reply: FastifyReply, resource: string): void {
  sendError(reply, 404, `${resource} not found`);
}

/** Shorthand for 409 conflict errors. */
export function sendConflict(reply: FastifyReply, message: string): void {
  sendError(reply, 409, message);
}

/** Shorthand for 501 not-implemented errors (stubs). */
export function sendNotImplemented(reply: FastifyReply): void {
  sendError(reply, 501, 'Not implemented');
}
