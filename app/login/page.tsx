'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { AuthLayout, InlineAlert } from '@/components/veritas-ui';

function getAuthErrorMessage(data: unknown, fallback: string) {
  if (!data || typeof data !== 'object') {
    return fallback;
  }

  const value = data as {
    error?: unknown;
    message?: unknown;
    details?: {
      fieldErrors?: Record<string, string[] | undefined>;
      formErrors?: string[];
    };
  };

  if (typeof value.message === 'string') return value.message;
  if (typeof value.error === 'string') return value.error;

  const fieldErrors = value.details?.fieldErrors;
  const firstFieldError =
    fieldErrors &&
    Object.values(fieldErrors).find(
      (errors): errors is string[] =>
        Array.isArray(errors) && errors.length > 0
    )?.[0];

  return (
    firstFieldError ||
    value.details?.formErrors?.[0] ||
    fallback
  );
}

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(getAuthErrorMessage(data, 'Login failed'));

        return;
      }

      router.push('/dashboard');
      router.refresh();
    } catch (error) {
      console.error(error);

      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-slate-50">
          Sign in to VeritasWeb
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Access your evidence capture workspace.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-300">
            Email
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-[#2A3A52] bg-[#0B1120] px-4 py-3 text-sm text-slate-50 outline-none transition placeholder:text-slate-500 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
            placeholder="you@example.com"
            autoComplete="email"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-300">
            Password
          </label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-[#2A3A52] bg-[#0B1120] px-4 py-3 text-sm text-slate-50 outline-none transition placeholder:text-slate-500 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
            placeholder="Enter password"
            autoComplete="current-password"
          />
        </div>

        {error && <InlineAlert tone="danger">{error}</InlineAlert>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-cyan-500 px-4 py-3 text-sm font-semibold text-[#06111A] transition hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-400">
        New to VeritasWeb?{' '}
        <Link href="/register" className="font-medium text-cyan-300 hover:text-cyan-200">
          Create account
        </Link>
      </p>
    </AuthLayout>
  );
}
