import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMailbox } from '@/api/mailbox';
import type { MailboxMessage } from '@shop/contracts';

/**
 * Dev mailbox page.
 * Lists all mailbox messages (e.g. password reset emails with clickable links).
 */
export function MailboxPage() {
  const [messages, setMessages] = useState<MailboxMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetch() {
      try {
        const data = await getMailbox();
        if (!cancelled) {
          setMessages(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load mailbox');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void fetch();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted-foreground">Loading mailbox…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-20 text-center">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  /**
   * Parse the reset link from a mailbox body.
   * Looks for the http://127.0.0.1:5173/reset-password?token=... pattern.
   */
  function extractResetLink(body: string): string | null {
    const match = body.match(/http:\/\/127\.0\.0\.1:5173\/reset-password\?token=[^\s]+/);
    return match ? match[0] : null;
  }

  return (
    <div className="mx-auto max-w-2xl py-10">
      <h1 className="text-2xl font-bold">QArefully Powder Co. Dev Mailbox</h1>

      {messages.length === 0 ? (
        <p className="mt-8 text-center text-muted-foreground">No powder correspondence yet.</p>
      ) : (
        <ul className="mt-6 space-y-4">
          {messages.map((msg) => {
            const resetLink = extractResetLink(msg.body);
            return (
              <li key={msg.id} className="rounded-lg border p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      To: <span className="font-medium text-foreground">{msg.recipient}</span>
                    </p>
                    <p className="mt-1 font-medium">{msg.subject}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(msg.created).toLocaleString()}
                  </span>
                </div>
                <div className="mt-2 text-sm">
                  {resetLink ? (
                    <Link
                      to={resetLink.replace('http://127.0.0.1:5173', '')}
                      className="text-blue-600 underline break-all"
                    >
                      {resetLink}
                    </Link>
                  ) : (
                    <p className="whitespace-pre-wrap text-muted-foreground">{msg.body}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
