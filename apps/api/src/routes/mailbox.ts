import { FastifyInstance } from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { MailboxListResponse } from '@shop/contracts';
import { getMailbox } from '../domains/auth.js';

/**
 * Dev mailbox routes.
 * Lists all mailbox messages (e.g. password reset emails).
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
      const messages = getMailbox();
      reply.code(200).send(
        messages.map((m) => ({
          id: String(m.id),
          recipient: m.recipient,
          subject: m.subject,
          body: m.body,
          kind: m.kind,
          created: m.created,
        })),
      );
    },
  );
}
