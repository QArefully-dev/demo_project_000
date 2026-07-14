import { Type, type Static } from '@sinclair/typebox';
import { EmailAddress } from './common.js';

export const MailboxMessage = Type.Object({
  id: Type.String({ minLength: 1 }),
  recipient: EmailAddress,
  subject: Type.String(),
  body: Type.String(),
  kind: Type.String(),
  created: Type.String(),
});
export type MailboxMessage = Static<typeof MailboxMessage>;
export const MailboxListResponse = Type.Array(MailboxMessage);
export type MailboxListResponse = Static<typeof MailboxListResponse>;
