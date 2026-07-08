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

/** Shorthand for 404 resource-not-found errors. */
export function sendNotFound(reply: FastifyReply, resource: string): void {
  sendError(reply, 404, `${resource} not found`);
}

/** Shorthand for 400 bad-request errors. */
export function sendBadRequest(reply: FastifyReply, message: string, details?: unknown): void {
  sendError(reply, 400, message, details);
}
