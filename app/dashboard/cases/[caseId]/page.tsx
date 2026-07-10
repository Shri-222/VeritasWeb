'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Briefcase, Download } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { AppShell, InlineAlert, StatusBadge } from '@/components/veritas-ui';
import { createClient } from '@/lib/supabase/client';

type CaseDetail = {
  case: { id: string; name: string; description: string | null; status: string };
  monitors: Array<{ id: string; url: string; status: string; frequency: string; capture_count: number; last_captured_at: string | null }>;
  captures: Array<{ id: string; monitor_id: string; page_title: string | null; final_url: string | null; captured_at: string; capture_status: string; manifest_sha256: string | null }>;
};

export default function CaseDetailPage() {
  const params = useParams<{ caseId: string }>();
  const router = useRouter();
  const [data, setData] = useState<CaseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data: sessionData } = await createClient().auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) { router.push('/login'); return; }
      const response = await fetch(`/api/cases/${params.caseId}`, { headers: { Authorization: `Bearer ${token}` } });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Failed to load case.');
      setData(result.data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load case.');
    } finally { setLoading(false); }
  }, [params.caseId, router]);

  useEffect(() => { load(); }, [load]);

  async function logout() { await fetch('/api/auth/logout', { method: 'POST' }); router.push('/login'); }

  async function downloadBundle() {
    setExporting(true);
    try {
      const token = (await createClient().auth.getSession()).data.session?.access_token;
      if (!token) throw new Error('Authentication required.');
      const response = await fetch(`/api/cases/${params.caseId}/bundle`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) { const result = await response.json(); throw new Error(result.message || 'Case bundle export failed.'); }
      const objectUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement('a'); link.href = objectUrl; link.download = `veritasweb-case-${params.caseId}.zip`; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(objectUrl);
    } catch (bundleError) { setError(bundleError instanceof Error ? bundleError.message : 'Case bundle export failed.'); }
    finally { setExporting(false); }
  }

  return (
    <AppShell onLogout={logout}>
      <div className="mx-auto max-w-6xl px-4 py-8">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-cyan-300 hover:text-cyan-200"><ArrowLeft className="h-4 w-4" />Back to Dashboard</Link>
        {loading && <p className="mt-8 text-sm text-slate-400">Loading case...</p>}
        {error && <div className="mt-6"><InlineAlert tone="danger">{error}</InlineAlert></div>}
        {data && <div className="mt-6 space-y-6">
          <section className="rounded-xl border border-[#2A3A52] bg-[#111827]/85 p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div><div className="flex items-center gap-2 text-sm text-cyan-300"><Briefcase className="h-4 w-4" />Case / workspace</div><h1 className="mt-3 text-3xl font-semibold text-white">{data.case.name}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{data.case.description || 'No description recorded.'}</p></div>
              <div className="flex items-center gap-3"><StatusBadge tone={data.case.status === 'active' ? 'success' : 'warning'}>{data.case.status}</StatusBadge><button type="button" onClick={downloadBundle} disabled={exporting} className="inline-flex items-center gap-2 rounded-md border border-cyan-500/40 px-3 py-2 text-sm text-cyan-100 hover:bg-cyan-500/10 disabled:opacity-50"><Download className="h-4 w-4" />{exporting ? 'Bundling...' : 'Download Case Bundle'}</button></div>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3"><div className="rounded-md border border-white/10 p-3"><span className="text-xs text-slate-500">Monitors</span><strong className="mt-1 block text-xl text-white">{data.monitors.length}</strong></div><div className="rounded-md border border-white/10 p-3"><span className="text-xs text-slate-500">Captures shown</span><strong className="mt-1 block text-xl text-white">{data.captures.length}</strong></div><div className="rounded-md border border-white/10 p-3"><span className="text-xs text-slate-500">Bundle scope</span><span className="mt-1 flex items-center gap-1 text-sm text-slate-500"><Download className="h-4 w-4" />Owner-scoped captures</span></div></div>
          </section>
          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-[#2A3A52] bg-[#111827]/85 p-5"><h2 className="font-semibold text-white">Monitors in this case</h2><div className="mt-4 space-y-3">{data.monitors.length === 0 && <p className="text-sm text-slate-500">No monitors assigned.</p>}{data.monitors.map((monitor) => <div key={monitor.id} className="rounded-md border border-white/10 p-3"><p className="break-words text-sm font-medium text-slate-100">{monitor.url}</p><p className="mt-1 text-xs text-slate-500">{monitor.frequency} · {monitor.capture_count} captures</p></div>)}</div></div>
            <div className="rounded-xl border border-[#2A3A52] bg-[#111827]/85 p-5"><h2 className="font-semibold text-white">Recent evidence records</h2><div className="mt-4 space-y-3">{data.captures.length === 0 && <p className="text-sm text-slate-500">No captures assigned.</p>}{data.captures.map((capture) => <Link key={capture.id} href={`/dashboard/captures/${capture.id}`} className="block rounded-md border border-white/10 p-3 transition hover:border-cyan-400/50"><p className="line-clamp-2 text-sm font-medium text-slate-100">{capture.page_title || 'Untitled capture'}</p><p className="mt-1 break-words text-xs text-slate-500">{capture.final_url || 'Unknown URL'}</p><p className="mt-2 text-xs text-emerald-300">{capture.manifest_sha256 ? 'Manifest recorded' : 'Legacy record'}</p></Link>)}</div></div>
          </section>
        </div>}
      </div>
    </AppShell>
  );
}

