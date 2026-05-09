'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function RegisterPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');

  const [password, setPassword] =
    useState('');

  const [confirmPassword, setConfirmPassword] =
    useState('');

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState('');

  const [success, setSuccess] =
    useState('');

  async function handleSubmit(
    e: React.FormEvent
  ) {
    e.preventDefault();

    setError('');
    setSuccess('');

    if (password !== confirmPassword) {
      setError(
        'Passwords do not match'
      );

      return;
    }

    if (password.length < 8) {
      setError(
        'Password must be at least 8 characters'
      );

      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        '/api/auth/register',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            email,
            password,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.error ||
            'Registration failed'
        );

        return;
      }

      setSuccess(
        'Account created successfully'
      );

      setTimeout(() => {
        router.push('/login');
      }, 1500);
    } catch (error) {
      console.error(error);

      setError(
        'Something went wrong'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight">
            Create Account
          </h1>

          <p className="text-zinc-400 mt-2 text-sm">
            Start monitoring web evidence securely
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-5"
        >
          <div>
            <label className="block text-sm mb-2 text-zinc-300">
              Email
            </label>

            <input
              type="email"
              required
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
              className="w-full rounded-xl bg-zinc-800 border border-zinc-700 px-4 py-3 outline-none focus:border-zinc-500 transition"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm mb-2 text-zinc-300">
              Password
            </label>

            <input
              type="password"
              required
              value={password}
              onChange={(e) =>
                setPassword(
                  e.target.value
                )
              }
              className="w-full rounded-xl bg-zinc-800 border border-zinc-700 px-4 py-3 outline-none focus:border-zinc-500 transition"
              placeholder="Minimum 8 characters"
            />
          </div>

          <div>
            <label className="block text-sm mb-2 text-zinc-300">
              Confirm Password
            </label>

            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) =>
                setConfirmPassword(
                  e.target.value
                )
              }
              className="w-full rounded-xl bg-zinc-800 border border-zinc-700 px-4 py-3 outline-none focus:border-zinc-500 transition"
              placeholder="Confirm password"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-white text-black font-medium py-3 hover:opacity-90 transition disabled:opacity-50"
          >
            {loading
              ? 'Creating account...'
              : 'Create Account'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-zinc-400">
          Already have an account?{' '}

          <Link
            href="/login"
            className="text-white hover:underline"
          >
            Sign in
          </Link>
        </div>
      </div>
    </main>
  );
}