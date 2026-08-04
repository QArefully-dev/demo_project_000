import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useCountry } from '@/hooks/CountryContext';
import { SUPPORTED_COUNTRIES, type Country } from '@shop/contracts/country';
import { Button } from '@/components/ui/button';
import { forgotPassword } from '@/api/auth';

export function ForgotPasswordPage() {
  const { activeCountry } = useCountry();
  const [email, setEmail] = useState('');
  const [country, setCountry] = useState<Country>(activeCountry);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setSubmitting(true);
    try {
      await forgotPassword({ email, country });
    } catch {
      // Always show success — no user enumeration.
    } finally {
      setSubmitting(false);
      setSent(true);
    }
  }

  if (sent) {
    return (
      <div className="mx-auto max-w-sm py-20 text-center">
        <h1 className="text-2xl font-bold">Check Your Email</h1>
        <p className="mt-4 text-muted-foreground">
          If an account with that email exists, we&apos;ve sent a password reset link.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Check the{' '}
          <Link to="/mailbox" className="underline">
            Dev Mailbox
          </Link>{' '}
          to find the reset link.
        </p>
        <p className="mt-4">
          <Link to="/login" className="text-sm underline">
            Back to Sign In
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm py-20">
      <h1 className="text-2xl font-bold text-center">Forgot Password</h1>

      <form onSubmit={(e) => void handleSubmit(e)} className="mt-8 space-y-4">
        <p className="text-sm text-muted-foreground">
          Enter your email address and we&apos;ll send you a link to reset your password.
        </p>

        <div>
          <label htmlFor="forgot-email" className="block text-sm font-medium">
            Email
          </label>
          <input
            id="forgot-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full rounded-md border px-3 py-2 text-sm"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label htmlFor="forgot-country" className="block text-sm font-medium">
            Country
          </label>
          <select
            id="forgot-country"
            value={country}
            onChange={(e) => setCountry(e.target.value as Country)}
            className="mt-1 block w-full rounded-md border px-3 py-2 text-sm"
          >
            {SUPPORTED_COUNTRIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <Button type="submit" disabled={submitting || !email.trim()} className="w-full">
          {submitting ? 'Sending…' : 'Send Reset Link'}
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
