import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { deleteAccount } from '@/api/accountDeletion';
import { ApiError } from '@/api/client';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/AuthContext';

const CONFIRMATION = 'delete my account';

function messageFor(error: unknown): string {
  if (error instanceof ApiError && error.status === 409) {
    return 'You own a company. Transfer company ownership before deleting this account.';
  }
  if (error instanceof ApiError) return error.response?.error ?? error.message;
  return error instanceof Error && error.message ? error.message : 'Unable to delete your account';
}

export function DeleteAccountSection() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!currentPassword) {
      setError('Current password is required');
      return;
    }
    if (confirmation !== CONFIRMATION) {
      setError(`Type "${CONFIRMATION}" to confirm`);
      return;
    }
    setSubmitting(true);
    try {
      await deleteAccount({ currentPassword });
    } catch (deleteError) {
      setError(messageFor(deleteError));
      setSubmitting(false);
      return;
    }

    try {
      await logout();
    } catch {
      // Account deletion already committed. Local auth cleanup and navigation must continue.
    }
    navigate('/', { replace: true });
    setSubmitting(false);
  }

  return (
    <section
      aria-labelledby="delete-account-heading"
      className="mt-6 rounded-lg border border-destructive/40 p-6"
    >
      <h2 id="delete-account-heading" className="text-base font-medium">
        Delete account
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        This permanently removes your account profile and signs you out.
      </p>
      <form className="mt-4 space-y-4" onSubmit={(event) => void submit(event)}>
        {error && (
          <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        )}
        <div>
          <label htmlFor="delete-account-password" className="block text-sm font-medium">
            Current password
          </label>
          <input
            id="delete-account-password"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            className="mt-1 block w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="delete-account-confirmation" className="block text-sm font-medium">
            Type “delete my account” to confirm
          </label>
          <input
            id="delete-account-confirmation"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            className="mt-1 block w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <Button type="submit" variant="destructive" disabled={submitting}>
          {submitting ? 'Deleting account…' : 'Delete account'}
        </Button>
      </form>
    </section>
  );
}
