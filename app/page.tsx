import Link from 'next/link';
import { ArrowRight, CheckCircle2, FileCheck2, LockKeyhole, ScanSearch, ShieldCheck } from 'lucide-react';
import { BrandMark } from '@/components/veritas-ui';

const steps = [
  ['01', 'Add a public webpage', 'Choose a public HTTP or HTTPS page and keep the monitored URL owner-scoped.'],
  ['02', 'Capture the record', 'Save a Playwright screenshot, HTML snapshot, headers, status, and page metadata.'],
  ['03', 'Create integrity records', 'Generate deterministic SHA-256 hashes for the stored artifacts and manifest.'],
  ['04', 'Verify and report', 'Recheck stored artifacts, review changes, and export a structured evidence report.'],
];

const features = [
  ['Full-page captures', 'Playwright captures the rendered page and source HTML in a server-side browser context.'],
  ['Private artifacts', 'Screenshots, HTML, and manifests stay in private storage with owner-checked access.'],
  ['Cryptographic verification', 'Recompute artifact hashes and compare them with the recorded evidence manifest.'],
  ['Scheduled monitoring', 'Use an external scheduler with the protected cron endpoint for recurring captures.'],
  ['Change detection', 'Compare consecutive captures with bounded text and metadata diffs.'],
  ['Evidence reports', 'Export stored capture data as a readable PDF and downloadable evidence bundle.'],
];

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#070B14] text-slate-100">
      <header className="border-b border-white/10 bg-[#070B14]/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 lg:px-8">
          <BrandMark />
          <nav className="flex items-center gap-3 text-sm">
            <Link href="/demo" className="hidden text-slate-300 transition hover:text-white sm:inline">View Demo</Link>
            <Link href="/login" className="rounded-md border border-white/15 px-4 py-2 text-slate-200 transition hover:border-cyan-400/60 hover:text-white">Sign in</Link>
            <Link href="/register" className="rounded-md bg-cyan-400 px-4 py-2 font-semibold text-[#06111A] transition hover:bg-cyan-300">Start Free</Link>
          </nav>
        </div>
      </header>

      <section className="relative border-b border-white/10">
        <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 py-20 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-28">
          <div>
            <p className="mb-5 text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">Evidence preservation workflow</p>
            <h1 className="max-w-3xl text-5xl font-semibold leading-[1.05] tracking-tight text-white sm:text-6xl">Preserve web pages before they disappear.</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">Capture public web pages, store screenshot and HTML artifacts, verify cryptographic hashes, detect changes, and export structured evidence reports.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/register" className="inline-flex items-center gap-2 rounded-md bg-cyan-400 px-5 py-3 font-semibold text-[#06111A] transition hover:bg-cyan-300"><span>Start Free</span><ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
              <Link href="/demo" className="rounded-md border border-white/15 px-5 py-3 font-semibold text-slate-100 transition hover:border-cyan-400/60">View Sample Evidence Record</Link>
            </div>
            <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-400">
              <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" />Private storage</span>
              <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" />Owner-scoped records</span>
              <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" />SHA-256 checks</span>
            </div>
          </div>
          <div className="rounded-xl border border-cyan-400/20 bg-[#0B1423] p-4 shadow-2xl shadow-cyan-950/30">
            <div className="rounded-lg border border-white/10 bg-[#0E1929] p-5">
              <div className="flex items-center justify-between border-b border-white/10 pb-4"><div className="flex items-center gap-2 text-sm font-semibold"><FileCheck2 className="h-4 w-4 text-cyan-300" />Evidence Record</div><span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-xs font-medium text-emerald-300">Integrity Verified</span></div>
              <div className="mt-5 space-y-4"><div><p className="text-xs uppercase tracking-widest text-slate-500">Captured page</p><p className="mt-1 text-lg font-semibold text-white">Example Terms of Service</p><p className="mt-1 break-words text-sm text-slate-400">https://www.example.com/terms</p></div><div className="grid grid-cols-3 gap-2 text-xs"><div className="rounded-md border border-white/10 p-3"><span className="text-slate-500">HTTP</span><strong className="mt-1 block text-slate-100">200 OK</strong></div><div className="rounded-md border border-white/10 p-3"><span className="text-slate-500">Artifacts</span><strong className="mt-1 block text-slate-100">3 stored</strong></div><div className="rounded-md border border-white/10 p-3"><span className="text-slate-500">Hashes</span><strong className="mt-1 block text-emerald-300">Match</strong></div></div><div className="h-32 rounded-md border border-cyan-400/20 bg-[linear-gradient(135deg,#12233a,#081121)] p-5"><div className="h-2 w-24 rounded bg-cyan-400/70" /><div className="mt-5 h-3 w-3/4 rounded bg-white/20" /><div className="mt-3 h-3 w-1/2 rounded bg-white/10" /><div className="mt-7 flex gap-2"><span className="h-2 w-12 rounded bg-cyan-400/50" /><span className="h-2 w-20 rounded bg-white/10" /></div></div></div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20 lg:px-8"><div className="max-w-2xl"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">The problem</p><h2 className="mt-3 text-3xl font-semibold text-white">The page you need tomorrow may not look like the page you saw today.</h2><p className="mt-4 leading-7 text-slate-400">Websites can be edited, removed, redirected, or replaced. A normal screenshot often leaves out the response context, source artifact, and a repeatable way to check that saved files were not altered.</p></div></section>

      <section className="border-y border-white/10 bg-[#0B1120]"><div className="mx-auto max-w-6xl px-5 py-20 lg:px-8"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">How it works</p><div className="mt-8 grid gap-4 md:grid-cols-4">{steps.map(([number, title, body]) => <article key={number} className="border-l border-cyan-400/30 pl-5"><span className="font-mono text-sm text-cyan-300">{number}</span><h3 className="mt-4 font-semibold text-white">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{body}</p></article>)}</div></div></section>

      <section className="mx-auto max-w-6xl px-5 py-20 lg:px-8"><div className="flex flex-col justify-between gap-6 md:flex-row md:items-end"><div><p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">Core features</p><h2 className="mt-3 text-3xl font-semibold text-white">A compact workflow for public web records.</h2></div><div className="flex items-center gap-2 text-sm text-slate-400"><LockKeyhole className="h-4 w-4 text-cyan-300" />Built around private, owner-scoped artifacts</div></div><div className="mt-10 grid gap-x-10 gap-y-8 md:grid-cols-2 lg:grid-cols-3">{features.map(([title, body]) => <article key={title} className="border-t border-white/10 pt-5"><h3 className="font-semibold text-white">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{body}</p></article>)}</div></section>

      <section className="border-y border-white/10 bg-[#0B1120]"><div className="mx-auto max-w-6xl px-5 py-20 lg:px-8"><div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]"><div><p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">Built for careful work</p><h2 className="mt-3 text-3xl font-semibold text-white">Monitor the pages that matter to your team.</h2></div><div className="grid grid-cols-2 gap-4 text-sm text-slate-300 sm:grid-cols-3">{['Terms and policy monitoring','Pricing and product changes','Trademark and brand monitoring','Public statement preservation','Journalism and investigations','Compliance review'].map((item) => <div key={item} className="flex gap-2"><ScanSearch className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />{item}</div>)}</div></div></div></section>

      <section className="mx-auto max-w-6xl px-5 py-20 lg:px-8"><div className="grid gap-10 lg:grid-cols-2"><div><p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">Security and integrity</p><h2 className="mt-3 text-3xl font-semibold text-white">A saved record with context you can inspect.</h2></div><div className="space-y-4 text-sm leading-6 text-slate-400"><p className="flex gap-3"><ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-emerald-400" />Private artifact storage and server-generated signed URLs after ownership checks.</p><p className="flex gap-3"><ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-emerald-400" />User-scoped records, SSRF protection, and server-only service-role access.</p><p className="flex gap-3"><ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-emerald-400" />Cryptographic checks that tell you whether stored files match their recorded hashes.</p></div></div></section>

      <section className="border-y border-white/10 bg-[#0B1120]"><div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-5 py-16 lg:flex-row lg:items-center lg:px-8"><div><p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">Start preserving web records.</p><h2 className="mt-3 text-3xl font-semibold text-white">See the workflow, then make it yours.</h2></div><div className="flex flex-wrap gap-3"><Link href="/register" className="rounded-md bg-cyan-400 px-5 py-3 font-semibold text-[#06111A] hover:bg-cyan-300">Create Free Account</Link><Link href="/demo" className="rounded-md border border-white/15 px-5 py-3 font-semibold text-slate-100 hover:border-cyan-400/60">View Demo</Link></div></div></section>
      <footer className="mx-auto max-w-6xl px-5 py-8 text-xs leading-6 text-slate-500 lg:px-8">VeritasWeb helps preserve and verify stored web captures. It does not independently guarantee legal admissibility and does not replace formal chain-of-custody, notarization, or jurisdiction-specific procedures.</footer>
    </main>
  );
}
