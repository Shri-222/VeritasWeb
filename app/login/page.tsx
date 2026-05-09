'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(
    e: React.FormEvent
  ) {
    e.preventDefault();

    setLoading(true);
    setError('');

    try {
      const response = await fetch(
        '/api/auth/login',
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
            'Login failed'
        );

        return;
      }

      router.push('/dashboard');
      router.refresh();
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
            VeritasWeb
          </h1>

          <p className="text-zinc-400 mt-2 text-sm">
            Secure forensic monitoring platform
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
              placeholder="Enter password"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-white text-black font-medium py-3 hover:opacity-90 transition disabled:opacity-50"
          >
            {loading
              ? 'Signing in...'
              : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-zinc-400">
          Don&apos;t have an account?{' '}

          <Link
            href="/register"
            className="text-white hover:underline"
          >
            Create account
          </Link>
        </div>
      </div>
    </main>
  );
}