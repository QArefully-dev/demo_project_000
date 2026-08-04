import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/AuthContext';
import { useCountry } from '@/hooks/CountryContext';
import { SUPPORTED_COUNTRIES, type Country } from '@shop/contracts/country';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ErrorMessage';
import { ApiError } from '@/api/client';
import { resolveLoginReturnPath } from './loginReturnPath';

export function LoginPage() {
  const { login } = useAuth();
  const { activeCountry } = useCountry();
  const location = useLocation();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [country, setCountry] = useState<Country>(activeCountry);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Email and password are required');
      return;
    }
    if (!SUPPORTED_COUNTRIES.includes(country)) {
      setError('Invalid country selection');
      return;
    }

    setSubmitting(true);
    try {
      await login(email, password, country);
      navigate(resolveLoginReturnPath(location.state), { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.response?.error ?? 'Login failed');
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm py-20">
      <h1 className="text-2xl font-bold text-center">Sign In</h1>

      <form onSubmit={(e) => void handleSubmit(e)} className="mt-8 space-y-4">
        {error && <ErrorMessage message={error} />}

        <div>
          <label htmlFor="login-email" className="block text-sm font-medium">
            Email
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full rounded-md border px-3 py-2 text-sm"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label htmlFor="login-password" className="block text-sm font-medium">
            Password
          </label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 block w-full rounded-md border px-3 py-2 text-sm"
            placeholder="Enter your password"
          />
        </div>

        <div>
          <label htmlFor="login-country" className="block text-sm font-medium">
            Country
          </label>
          <select
            id="login-country"
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

        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? 'Signing in…' : 'Sign In'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{' '}
        <Link to="/signup" className="underline">
          Sign up
        </Link>
      </p>
      <p className="mt-2 text-center text-sm text-muted-foreground">
        <Link to="/forgot-password" className="underline">
          Forgot your password?
        </Link>
      </p>
    </div>
  );
}
