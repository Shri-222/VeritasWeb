'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import {
  Check,
  Copy,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Tone = 'default' | 'success' | 'warning' | 'danger' | 'info';

const toneClasses: Record<Tone, string> = {
  default: 'border-slate-600 bg-slate-800/80 text-slate-200',
  success: 'border-green-500/40 bg-green-500/10 text-green-300',
  warning: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
  danger: 'border-red-500/40 bg-red-500/10 text-red-300',
  info: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-200',
};

export function BrandMark({
  compact = false,
}: {
  compact?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-cyan-400/45 bg-cyan-400/10 text-cyan-300 shadow-[0_0_28px_rgba(6,182,212,0.16),0_0_34px_rgba(139,92,246,0.10)]">
        <ShieldCheck className="h-5 w-5" aria-hidden="true" />
      </div>
      {!compact && (
        <div className="leading-tight">
          <p className="text-lg font-semibold text-slate-50">
            Veritas<span className="text-cyan-300">Web</span>
          </p>
          <p className="text-xs text-slate-400">
            Forensic Web Capture Platform
          </p>
        </div>
      )}
    </div>
  );
}

export function AppShell({
  children,
  onLogout,
}: {
  children: ReactNode;
  onLogout?: () => void;
}) {
  return (
    <main className="min-h-screen bg-[#070B14] text-slate-50">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(6,182,212,0.16),transparent_28%),radial-gradient(circle_at_82%_4%,rgba(59,130,246,0.12),transparent_28%),linear-gradient(180deg,#070B14_0%,#0B1120_48%,#070B14_100%)]" />
      <div className="pointer-events-none fixed inset-0 opacity-[0.18] [background-image:linear-gradient(rgba(148,163,184,0.10)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.10)_1px,transparent_1px)] [background-size:48px_48px]" />
      <div className="relative">
        <header className="border-b border-[#2A3A52]/80 bg-[#070B14]/85 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
            <Link href="/dashboard" className="min-w-0">
              <BrandMark />
            </Link>
            <div className="flex items-center gap-3">
              <Link href="/dashboard#cases" className="hidden text-sm text-slate-400 transition hover:text-cyan-200 sm:inline">
                Cases
              </Link>
              <span className="hidden rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-200 sm:inline-flex">
                Secure Capture MVP
              </span>
              {onLogout && (
                <Button
                  type="button"
                  onClick={onLogout}
                  variant="outline"
                  className="border-[#2A3A52] bg-[#111827]/80 text-slate-200 hover:bg-[#172033] hover:text-white"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  Logout
                </Button>
              )}
            </div>
          </div>
        </header>
        {children}
      </div>
    </main>
  );
}

export function AuthLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#070B14] text-slate-50">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_28%_30%,rgba(6,182,212,0.18),transparent_30%),radial-gradient(circle_at_72%_18%,rgba(59,130,246,0.12),transparent_26%),linear-gradient(135deg,#070B14_0%,#0B1120_56%,#111827_100%)]" />
      <div className="pointer-events-none fixed inset-0 opacity-[0.20] [background-image:linear-gradient(rgba(148,163,184,0.10)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.10)_1px,transparent_1px)] [background-size:52px_52px]" />
      <div className="relative mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-4 py-10 lg:grid-cols-[1fr_440px]">
        <section className="max-w-2xl">
          <BrandMark />
          <h1 className="mt-10 max-w-xl text-4xl font-semibold leading-tight text-slate-50 sm:text-5xl">
            Preserve web pages before they disappear.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-slate-300">
            Capture public web pages, store private evidence artifacts, verify
            SHA-256 hashes, and export structured evidence reports.
          </p>
          <div className="mt-8 grid gap-3 text-sm text-slate-300">
            {[
              'Playwright-based full-page capture',
              'Screenshot + HTML artifact storage',
              'SHA-256 integrity verification',
            ].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-md border border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
                  <Check className="h-4 w-4" aria-hidden="true" />
                </span>
                <span>{item}</span>
              </div>
            ))}
          </div>
          <p className="mt-8 max-w-xl rounded-lg border border-[#2A3A52] bg-[#111827]/70 p-4 text-sm leading-6 text-slate-400">
            Built for forensic-style evidence preservation workflows. Legal
            admissibility depends on jurisdiction and process.
          </p>
        </section>
        <section className="rounded-xl border border-[#2A3A52] bg-[#111827]/90 p-6 shadow-2xl shadow-black/40 backdrop-blur">
          {children}
        </section>
      </div>
    </main>
  );
}

export function InlineAlert({
  tone = 'info',
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  return (
    <div className={cn('rounded-lg border px-4 py-3 text-sm', toneClasses[tone])}>
      {children}
    </div>
  );
}

export function StatusBadge({
  tone = 'default',
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium',
        toneClasses[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function CopyButton({
  value,
  label = 'Copy',
}: {
  value: string | null | undefined;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copyValue() {
    if (!value) return;

    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <button
      type="button"
      onClick={copyValue}
      disabled={!value}
      title={label}
      aria-label={label}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#2A3A52] bg-[#0B1120] text-slate-300 transition hover:border-cyan-500/60 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {copied ? (
        <Check className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Copy className="h-4 w-4" aria-hidden="true" />
      )}
    </button>
  );
}
