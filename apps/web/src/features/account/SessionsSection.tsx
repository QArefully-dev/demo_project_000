import { useCallback, useEffect, useState } from 'react';
import type { SessionSummary } from '@shop/contracts/account-depth';
import { ApiError } from '@/api/client';
import { listAccountSessions, revokeAccountSession } from '@/api/accountSessions';
import { Button } from '@/components/ui/button';

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.response?.error ?? error.message;
  return error instanceof Error && error.message ? error.message : fallback;
}

function describeSession(session: SessionSummary): string {
  const agent = session.userAgent ?? 'Unknown device';
  const seen = session.lastSeenAt ?? session.createdAt;
  return `${agent} · Last active ${new Date(seen).toLocaleString()}`;
}

/** Buyer-owned session list. A successful revoke is reconciled against a fresh server list. */
export function SessionsSection() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSessions(await listAccountSessions());
    } catch (loadError) {
      setError(errorMessage(loadError, 'Unable to load signed-in sessions'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function revoke(session: SessionSummary) {
    const previous = sessions;
    let revokeCommitted = false;
    setError(null);
    setRevoking(true);
    setSessions((items) => items.filter((item) => item.sessionId !== session.sessionId));
    try {
      await revokeAccountSession(session.sessionId);
      revokeCommitted = true;
      await load();
    } catch (revokeError) {
      if (!revokeCommitted) setSessions(previous);
      setError(errorMessage(revokeError, 'Unable to sign out this session'));
    } finally {
      setRevoking(false);
    }
  }

  return (
    <section aria-labelledby="sessions-heading" className="mt-6 rounded-lg border p-6">
      <h2 id="sessions-heading" className="text-base font-medium">
        Signed-in sessions
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Review devices currently signed in to your account.
      </p>
      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {loading ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading sessions…</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {sessions.map((session) => (
            <li
              key={session.sessionId}
              className="flex items-start justify-between gap-4 rounded-lg border p-4"
            >
              <div>
                <p className="font-medium">
                  {session.isCurrent ? 'Current session' : 'Signed-in session'}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{describeSession(session)}</p>
              </div>
              <div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={session.isCurrent || revoking}
                  aria-describedby={
                    session.isCurrent ? `current-session-${session.sessionId}` : undefined
                  }
                  onClick={() => void revoke(session)}
                >
                  {revoking ? 'Signing out…' : 'Sign out this session'}
                </Button>
                {session.isCurrent && (
                  <p id={`current-session-${session.sessionId}`} className="sr-only">
                    This is your current session and cannot be signed out here.
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {!loading && sessions.length === 0 && (
        <p className="mt-4 text-sm text-muted-foreground">No signed-in sessions found.</p>
      )}
    </section>
  );
}
