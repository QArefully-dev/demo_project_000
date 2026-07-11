import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ErrorMessage';
import { resetPassword } from '@/api/auth';
import { ApiError } from '@/api/client';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get('token') ?? '';

  const [token, setToken] = useState(tokenFromUrl);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!token.trim()) {
      setError('Reset token is required');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setSubmitting(true);
    try {
      await resetPassword({ token, newPassword });
      setSuccess(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.response?.error ?? 'Password reset failed');
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="mx-auto max-w-sm py-20 text-center">
        <h1 className="text-2xl font-bold">Password Reset</h1>
        <p className="mt-4 text-muted-foreground">Your password has been reset successfully.</p>
        <p className="mt-4">
          <Link to="/login" className="text-sm underline">
            Sign in with your new password
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm py-20">
      <h1 className="text-2xl font-bold text-center">Reset Password</h1>

      <form onSubmit={(e) => void handleSubmit(e)} className="mt-8 space-y-4">
        {error && <ErrorMessage message={error} />}

        {!tokenFromUrl && (
          <div>
            <label htmlFor="reset-token" className="block text-sm font-medium">
              Reset Token
            </label>
            <input
              id="reset-token"
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="mt-1 block w-full rounded-md border px-3 py-2 text-sm font-mono"
              placeholder="Paste your reset token"
            />
          </div>
        )}

        <div>
          <label htmlFor="reset-password" className="block text-sm font-medium">
            New Password
          </label>
          <input
            id="reset-password"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="mt-1 block w-full rounded-md border px-3 py-2 text-sm"
            placeholder="At least 8 characters"
          />
        </div>

        <div>
          <label htmlFor="reset-confirm" className="block text-sm font-medium">
            Confirm Password
          </label>
          <input
            id="reset-confirm"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="mt-1 block w-full rounded-md border px-3 py-2 text-sm"
            placeholder="Re-enter new password"
          />
        </div>

        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? 'Resetting…' : 'Reset Password'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link to="/login" className="underline">
          Back to Sign In
        </Link>
      </p>
    </div>
  );
}
