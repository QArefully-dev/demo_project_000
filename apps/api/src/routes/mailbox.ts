import { FastifyInstance } from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { MailboxListResponse } from '@shop/contracts/mailbox';
import type { AppContext } from '../app.js';

/**
 * Dev mailbox routes.
 * Lists all mailbox messages (e.g. password reset emails).
 */
export default function mailboxRoutes(app: FastifyInstance, { services }: AppContext): void {
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
      const messages = services.mailbox.list();
      reply.code(200).send(messages);
    },
  );
}
