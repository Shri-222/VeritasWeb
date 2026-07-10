'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { CheckCircle2, Circle } from 'lucide-react';
import { AuthLayout, InlineAlert } from '@/components/veritas-ui';

const PASSWORD_ERROR =
  'Password must include at least 8 characters, one uppercase letter, one lowercase letter, one number, and one special character.';

function getPasswordChecks(password: string) {
  return [
    {
      label: 'At least 8 characters',
      met: password.length >= 8,
    },
    {
      label: 'One uppercase letter',
      met: /[A-Z]/.test(password),
    },
    {
      label: 'One lowercase letter',
      met: /[a-z]/.test(password),
    },
    {
      label: 'One number',
      met: /[0-9]/.test(password),
    },
    {
      label: 'One special character',
      met: /[^A-Za-z0-9\s]/.test(password),
    },
  ];
}

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

export default function RegisterPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const passwordChecks = getPasswordChecks(password);
  const passwordIsValid = passwordChecks.every((check) => check.met);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    setError('');
    setSuccess('');

    if (!passwordIsValid) {
      setError(PASSWORD_ERROR);

      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');

      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/register', {
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
        setError(
          getAuthErrorMessage(data, 'Registration failed')
        );

        return;
      }

      setSuccess('Account created successfully');

      setTimeout(() => {
        router.push('/login');
      }, 1500);
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
          Create your VeritasWeb account
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Start capturing and verifying web evidence records.
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
            placeholder="Minimum 8 characters"
            autoComplete="new-password"
          />
          <div className="mt-3 grid gap-2 rounded-lg border border-[#2A3A52] bg-[#0B1120]/70 p-3">
            {passwordChecks.map((check) => (
              <div
                key={check.label}
                className={
                  check.met
                    ? 'flex items-center gap-2 text-xs text-green-300'
                    : 'flex items-center gap-2 text-xs text-slate-500'
                }
              >
                {check.met ? (
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Circle className="h-4 w-4" aria-hidden="true" />
                )}
                <span>{check.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-300">
            Confirm Password
          </label>
          <input
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded-lg border border-[#2A3A52] bg-[#0B1120] px-4 py-3 text-sm text-slate-50 outline-none transition placeholder:text-slate-500 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
            placeholder="Confirm password"
            autoComplete="new-password"
          />
        </div>

        {error && <InlineAlert tone="danger">{error}</InlineAlert>}
        {success && <InlineAlert tone="success">{success}</InlineAlert>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-cyan-500 px-4 py-3 text-sm font-semibold text-[#06111A] transition hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Creating account...' : 'Create Account'}
        </button>
      </form>

      <p className="mt-5 rounded-lg border border-[#2A3A52] bg-[#0B1120]/80 p-3 text-xs leading-5 text-slate-400">
        Use a secure password. Local QA accounts can be deleted from Supabase
        Auth.
      </p>

      <p className="mt-6 text-center text-sm text-slate-400">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-cyan-300 hover:text-cyan-200">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
