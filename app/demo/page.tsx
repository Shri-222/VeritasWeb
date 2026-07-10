'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, ChevronDown, ChevronUp, Download, ExternalLink, FileCheck2, FileJson, ShieldCheck } from 'lucide-react';
import { BrandMark, InlineAlert, StatusBadge } from '@/components/veritas-ui';
import sampleManifest from '@/public/demo/sample-manifest.json';
import sampleMetadata from '@/public/demo/sample-metadata.json';

const verificationSteps = ['Screenshot hash', 'HTML hash', 'Manifest hash', 'Integrity Verified'];

export default function DemoPage() {
  const [artifactsOpen, setArtifactsOpen] = useState(false);
  const [hashesOpen, setHashesOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [verificationStep, setVerificationStep] = useState(-1);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (verificationStep < 0 || verificationStep >= verificationSteps.length || reducedMotion) return;
    const timer = window.setTimeout(() => setVerificationStep((value) => value + 1), 520);
    return () => window.clearTimeout(timer);
  }, [reducedMotion, verificationStep]);

  function runDemoVerification() {
    if (reducedMotion) {
      setVerificationStep(verificationSteps.length - 1);
      return;
    }
    setVerificationStep(0);
  }

  const verified = verificationStep === verificationSteps.length - 1;

  return (
    <main className="min-h-screen bg-[#070B14] text-slate-100">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 lg:px-8">
          <BrandMark />
          <div className="flex items-center gap-3 text-sm"><Link href="/" className="text-slate-400 hover:text-white">Home</Link><Link href="/register" className="rounded-md bg-cyan-400 px-4 py-2 font-semibold text-[#06111A]">Start Free</Link></div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-10 lg:px-8">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-cyan-300 hover:text-cyan-200"><ArrowLeft className="h-4 w-4" />Back to VeritasWeb</Link>
        <section className="mt-8 overflow-hidden rounded-xl border border-cyan-400/20 bg-[#0E1929] shadow-2xl shadow-cyan-950/20">
          <div className="border-b border-white/10 bg-[#0B1423] px-6 py-7 sm:px-8">
            <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-sm text-cyan-300"><FileCheck2 className="h-4 w-4" />Evidence Record</div><h1 className="mt-3 text-3xl font-semibold text-white">{sampleManifest.page_title}</h1><p className="mt-2 break-words text-sm text-slate-400">{sampleManifest.original_url}</p></div><StatusBadge tone="warning">Demo Record</StatusBadge></div>
            <InlineAlert tone="info"><span className="font-semibold">Read-only demo.</span> This demonstration uses bundled sample artifacts and does not access private user records.</InlineAlert>
          </div>

          <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <div className="flex items-center justify-between gap-3"><p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Screenshot preview</p><StatusBadge tone="success">200 OK</StatusBadge></div>
              <div className="mt-4 overflow-hidden rounded-lg border border-white/10 bg-[#081121] p-3"><div className="max-h-[520px] overflow-auto rounded border border-cyan-400/20"><img src="/demo/iana-screenshot.png" alt="Bundled screenshot of the IANA reserved domains page" className="block w-full" /></div></div>
              <div className="mt-3 flex flex-wrap gap-2"><a href="/demo/iana-screenshot.png" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-sm text-slate-200 hover:border-cyan-400/50"><ExternalLink className="h-4 w-4" />Open Screenshot</a><button type="button" onClick={() => setArtifactsOpen((value) => !value)} className="inline-flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-sm text-slate-200 hover:border-cyan-400/50">{artifactsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}Inspect Artifacts</button></div>
              {artifactsOpen && <div className="mt-4 grid gap-3 sm:grid-cols-3"><Artifact icon="image" label="Screenshot PNG" path="/demo/iana-screenshot.png" /><Artifact icon="html" label="HTML Snapshot" path="/demo/iana-page.html" /><Artifact icon="json" label="Manifest JSON" path="/demo/sample-manifest.json" /></div>}
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm"><Detail label="Captured at" value={new Date(sampleManifest.captured_at).toLocaleString()} /><Detail label="Trigger type" value="Demo / read-only" /><Detail label="Original URL" value={sampleManifest.original_url} wide /><Detail label="Final URL" value={sampleManifest.final_url} wide /></div>
              <div className="rounded-lg border border-white/10 bg-[#081121] p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-widest text-slate-500">Integrity status</p><p className={`mt-2 text-lg font-semibold ${verified ? 'text-emerald-300' : 'text-slate-100'}`}>{verified ? 'Integrity Verified' : verificationStep >= 0 ? 'Checking bundled artifacts...' : 'Ready to verify'}</p></div><CheckCircle2 className={`h-7 w-7 ${verified ? 'text-emerald-400' : 'text-slate-600'}`} aria-hidden="true" /></div><div className="mt-4 space-y-2">{verificationSteps.map((step, index) => <div key={step} className="flex items-center gap-3 text-sm"><span className={`flex h-5 w-5 items-center justify-center rounded-full border ${index <= verificationStep ? 'border-emerald-400 bg-emerald-400/15 text-emerald-300' : 'border-white/15 text-slate-600'}`}>{index <= verificationStep ? <CheckCircle2 className="h-3.5 w-3.5" /> : index + 1}</span><span className={index <= verificationStep ? 'text-slate-200' : 'text-slate-500'}>{step}</span></div>)}</div><button type="button" onClick={runDemoVerification} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-[#06111A] hover:bg-cyan-300"><ShieldCheck className="h-4 w-4" />Run Demo Verification</button></div>
              <button type="button" onClick={() => setHashesOpen((value) => !value)} className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-[#081121] px-4 py-3 text-left text-sm font-semibold text-slate-200 hover:border-cyan-400/40"><span>View Integrity Hashes</span>{hashesOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</button>
              {hashesOpen && <div className="space-y-3 rounded-lg border border-white/10 bg-[#081121] p-4"><Hash label="Screenshot SHA-256" value={sampleManifest.screenshot_sha256} /><Hash label="HTML SHA-256" value={sampleManifest.html_sha256} /><Hash label="Manifest SHA-256" value={sampleMetadata.manifest_sha256} /></div>}
              <div className="rounded-lg border border-white/10 bg-[#081121] p-4"><p className="text-xs uppercase tracking-widest text-slate-500">Response-header preview</p><pre className="mt-3 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-5 text-slate-400">{JSON.stringify(sampleManifest.headers, null, 2)}</pre></div>
            </div>
          </div>

          <section className="border-t border-white/10 bg-[#0B1423] px-6 py-7 sm:px-8"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-semibold uppercase tracking-widest text-cyan-300">Sample Change Detection</p><h2 className="mt-2 text-2xl font-semibold text-white">What changed between two stored records?</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Both records can remain independently verified while the comparison shows what changed between them. This sample score has no legal or scientific authority.</p></div><StatusBadge tone="warning">Read-only sample</StatusBadge></div><div className="mt-6 grid gap-4 md:grid-cols-[0.8fr_0.8fr_1.4fr]"><div className="rounded-lg border border-white/10 p-4"><p className="text-xs text-slate-500">Capture 1</p><p className="mt-2 text-sm text-slate-200">Reserved domains page</p><p className="mt-2 text-xs text-slate-500">HTTP 200 · verified</p></div><div className="rounded-lg border border-white/10 p-4"><p className="text-xs text-slate-500">Capture 2</p><p className="mt-2 text-sm text-slate-200">Reserved domains page</p><p className="mt-2 text-xs text-slate-500">HTTP 200 · verified</p></div><div className="rounded-lg border border-cyan-400/20 bg-cyan-400/5 p-4"><p className="text-xs uppercase tracking-widest text-cyan-300">What changed</p><ul className="mt-3 space-y-2 text-sm text-slate-300"><li><span className="text-emerald-300">Added:</span> one sentence in the page body</li><li><span className="text-red-300">Removed:</span> one previous notice</li><li><span className="text-amber-300">Metadata:</span> Last-Modified value changed</li></ul></div></div></section>

          <section className="border-t border-white/10 px-6 py-6 sm:px-8"><div className="flex flex-wrap gap-3"><button type="button" onClick={() => setReportOpen((value) => !value)} className="inline-flex items-center gap-2 rounded-md border border-white/10 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:border-cyan-400/50"><FileCheck2 className="h-4 w-4" />{reportOpen ? 'Hide Sample Report' : 'Preview Sample Report'}</button><a href="/demo/sample-report.pdf" download className="inline-flex items-center gap-2 rounded-md bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-[#06111A] hover:bg-cyan-300"><Download className="h-4 w-4" />Download Sample PDF</a><Link href="/register" className="inline-flex items-center gap-2 rounded-md border border-white/10 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:border-cyan-400/50">Create Your Own Record</Link></div>{reportOpen && <div className="mt-5 overflow-hidden rounded-lg border border-white/10 bg-white"><iframe title="Sample evidence preservation report" src="/demo/sample-report.pdf" className="h-[680px] w-full" /></div>}</section>
        </section>
        <p className="mt-6 text-xs leading-6 text-slate-500">This is a read-only sample showing the VeritasWeb evidence workflow. It uses bundled sample artifacts and does not access private user records or private signed URLs.</p>
      </div>
    </main>
  );
}

function Detail({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) { return <div className={`rounded-md border border-white/10 p-3 ${wide ? 'col-span-2' : ''}`}><span className="text-xs text-slate-500">{label}</span><strong className="mt-1 block break-words text-sm font-medium text-slate-200">{value}</strong></div>; }
function Hash({ label, value }: { label: string; value: string }) { return <div><p className="text-xs text-slate-500">{label}</p><code className="mt-1 block break-all font-mono text-[11px] leading-5 text-slate-400">{value}</code></div>; }
function Artifact({ icon, label, path }: { icon: string; label: string; path: string }) { return <a href={path} target="_blank" rel="noreferrer" className="rounded-md border border-white/10 p-3 transition hover:border-cyan-400/50"><div className="flex items-center gap-2 text-sm text-slate-200">{icon === 'json' ? <FileJson className="h-4 w-4 text-cyan-300" /> : <FileCheck2 className="h-4 w-4 text-cyan-300" />}{label}</div><p className="mt-2 break-words text-xs text-slate-500">Open bundled artifact</p></a>; }
