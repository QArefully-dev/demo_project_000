import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { acceptInvite } from '@/api/companyAccounts';
import { ApiError } from '@/api/client';
import { Button } from '@/components/ui/button';

export function AcceptInvitePage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [error, setError] = useState<string | null>(
    token ? null : 'This invitation link is missing its token.',
  );
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  async function accept() {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      await acceptInvite({ token });
      setAccepted(true);
    } catch (error) {
      setError(
        error instanceof ApiError
          ? (error.response?.error ?? error.message)
          : 'Unable to accept invitation.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="mx-auto max-w-xl py-12">
      <h1 className="text-2xl font-bold">Company invitation</h1>
      {accepted ? (
        <div className="mt-5 rounded-lg border p-5">
          <p role="status">Invitation accepted. You are now a company member.</p>
          <Link className="mt-3 inline-block underline" to="/account/company">
            View company account
          </Link>
        </div>
      ) : (
        <div className="mt-5 rounded-lg border p-5">
          <p>Accept this invitation to join the company account.</p>
          {error && (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {error}
            </p>
          )}
          <Button
            type="button"
            className="mt-4"
            disabled={busy || !token}
            onClick={() => void accept()}
          >
            {busy ? 'Accepting…' : 'Accept invitation'}
          </Button>
        </div>
      )}
    </main>
  );
}
