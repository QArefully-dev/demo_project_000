import { FastifyInstance } from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { sendNotImplemented } from '../utils/errors.js';
import { MailboxListResponse } from '@shop/contracts';

/**
 * Dev mailbox routes — stub (Wave 0).
 * Returns 501 "Not implemented".
 * Real implementation deferred to W1.A.
 */
export default function mailboxRoutes(app: FastifyInstance): void {
  const typed = app.withTypeProvider<TypeBoxTypeProvider>();

  typed.get(
    '/api/dev/mailbox',
    {
      schema: {
        response: {
          200: MailboxListResponse,
        },
      },
    },
    async (_request, reply) => {
      sendNotImplemented(reply);
    },
  );
}
